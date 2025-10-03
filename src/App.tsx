import { useState, useEffect } from 'react'
import {
  CameraCapture,
  ImagePreview,
  RegionSelector,
  ReceiptForm,
  ExportPanel,
  ErrorBoundary,
  NotificationCenter,
  HelpSystem,
  useNotifications,
  useHelp
} from './components'
import { Receipt, ReceiptData, Rectangle, AppError } from './types'
import { serviceRegistry } from './utils/serviceRegistry'
import { configManager } from './utils/configManager'
import './App.css'

type AppView = 'capture' | 'process' | 'history' | 'settings'

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>('capture')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showRegionSelector, setShowRegionSelector] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [performanceInfo, setPerformanceInfo] = useState<any>(null)
  const [isAppInitialized, setIsAppInitialized] = useState(false)

  // Use notification and help hooks
  const notifications = useNotifications()
  const { isHelpOpen, openHelp, closeHelp } = useHelp()

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize service registry and all services
        await serviceRegistry.initialize()
        
        // Get services from registry
        const storage = serviceRegistry.getStorage()
        const ocrEngine = serviceRegistry.getOCREngine()
        
        // Load saved receipts
        const savedReceipts = await storage.getReceipts()
        setReceipts(savedReceipts)

        // Update performance info
        setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
        setIsAppInitialized(true)

        notifications.showSuccess('初期化完了', 'アプリケーションが正常に初期化されました', 2000)
      } catch (err) {
        try {
          const errorHandler = serviceRegistry.getErrorHandler() as any
          const appError = errorHandler.handleError(err as Error, {
            component: 'App',
            operation: 'initialize'
          })
          notifications.showError('初期化エラー', errorHandler.getLocalizedMessage(appError))
        } catch {
          notifications.showError('初期化エラー', 'アプリケーションの初期化に失敗しました')
        }
      }
    }

    initializeApp()

    // Cleanup on unmount
    return () => {
      serviceRegistry.destroy()
    }
  }, [notifications])

  const handleImageCapture = async (capturedImageData: ImageData) => {
    if (!isAppInitialized) {
      notifications.showError('初期化エラー', 'アプリケーションがまだ初期化されていません')
      return
    }

    setImageData(capturedImageData)
    setIsProcessing(true)
    
    // Show progress notification
    const progressId = notifications.showProgress(
      'OCR処理中',
      '画像からテキストを抽出しています...',
      0,
      'モデル初期化'
    )
    setProcessingId(progressId)

    try {
      // Get services from registry
      const ocrEngine = serviceRegistry.getOCREngine()
      const dataExtractor = serviceRegistry.getDataExtractor()
      const errorRecovery = serviceRegistry.getErrorRecovery() as any
      const config = configManager.getOCRSettings()

      // Initialize OCR engine if not already done
      notifications.updateProgress(progressId, 20, 'OCRエンジンを初期化中...', 'モデル読み込み')
      
      await errorRecovery.retryModelLoad(
        () => ocrEngine.initialize(),
        'paddle_ocr'
      )

      // Preload models for better performance
      notifications.updateProgress(progressId, 30, 'モデルを読み込み中...', 'パフォーマンス最適化')
      try {
        await ocrEngine.preloadModels()
      } catch (error) {
        console.warn('Model preloading failed:', error)
      }
      
      // Process the image with OCR
      notifications.updateProgress(progressId, 50, 'テキストを検出中...', 'OCR実行')
      
      const ocrResults = await errorRecovery.retryOCR(capturedImageData, ocrEngine)
      
      // Extract receipt data
      notifications.updateProgress(progressId, 80, 'データを抽出中...', 'データ解析')
      
      const extractedData = dataExtractor.extractReceiptData(ocrResults)
      
      notifications.updateProgress(progressId, 100, '処理完了', '完了')
      
      setReceiptData(extractedData)

      // Update performance info
      setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
      
      // Check for low confidence results using config threshold
      const lowConfidenceFields = Object.entries(extractedData).filter(
        ([key, field]) => key !== 'metadata' && (field as any).confidence < config.confidenceThreshold
      )
      
      if (lowConfidenceFields.length > 0) {
        lowConfidenceFields.forEach(([fieldName, field]) => {
          notifications.showWarning(
            '信頼度が低いフィールド',
            `${fieldName}の信頼度が低いです (${((field as any).confidence * 100).toFixed(1)}%)`
          )
        })
      }
      
    } catch (err) {
      const errorHandler = serviceRegistry.getErrorHandler() as any
      const appError = errorHandler.handleError(err as Error, {
        component: 'App',
        operation: 'image_capture',
        metadata: { 
          retryFunction: () => handleImageCapture(capturedImageData),
          enableManualInput: () => setReceiptData({
            date: { value: '', confidence: 0, candidates: [] },
            payee: { value: '', confidence: 0, candidates: [] },
            amount: { value: '', confidence: 0, candidates: [] },
            usage: { value: '', confidence: 0, candidates: [] },
            metadata: { processedAt: new Date(), imageHash: '' }
          })
        }
      })
      
      const recoveryActions = errorHandler.getRecoveryActions(appError)
      notifications.showError(
        'OCR処理エラー',
        errorHandler.getLocalizedMessage(appError),
        recoveryActions.map((action: any) => ({
          label: action.label,
          action: action.action,
          style: action.type === 'retry' ? 'primary' : 'secondary'
        }))
      )
      
      if (progressId) {
        notifications.remove(progressId)
      }
    } finally {
      setIsProcessing(false)
      setProcessingId(null)
    }
  }

  const handleRegionSelect = (region: Rectangle, ocrResults?: any[]) => {
    setShowRegionSelector(false)
    
    if (ocrResults && ocrResults.length > 0 && receiptData && isAppInitialized) {
      const dataExtractor = serviceRegistry.getDataExtractor()
      
      // Add candidates to each field type
      let updatedData = receiptData
      
      // Try to add candidates for each field type
      const fieldTypes: Array<'date' | 'payee' | 'amount' | 'usage'> = ['date', 'payee', 'amount', 'usage']
      
      for (const fieldType of fieldTypes) {
        try {
          updatedData = dataExtractor.addRegionCandidates(updatedData, ocrResults, fieldType)
        } catch (error) {
          console.warn(`Failed to add candidates for ${fieldType}:`, error)
        }
      }
      
      setReceiptData(updatedData)
      
      // Add processing history entry
      if (updatedData.metadata) {
        updatedData.metadata.processedAt = new Date()
      }
    }
  }

  const handleDataChange = (data: ReceiptData) => {
    setReceiptData(data)
  }

  const handleSave = async () => {
    if (!imageData || !receiptData || !isAppInitialized) return

    const receipt: Receipt = {
      id: crypto.randomUUID(),
      imageData,
      extractedData: receiptData,
      processingHistory: [{
        type: 'auto_ocr',
        timestamp: new Date()
      }],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    try {
      const storage = serviceRegistry.getStorage()
      await storage.saveReceipt(receipt)
      setReceipts((prev: Receipt[]) => [...prev, receipt])
      
      notifications.showSuccess('保存完了', '領収書データが正常に保存されました')
      
      // Reset form
      setImageData(null)
      setReceiptData(null)
    } catch (err) {
      const errorHandler = serviceRegistry.getErrorHandler() as any
      const appError = errorHandler.handleError(err as Error, {
        component: 'App',
        operation: 'save_receipt'
      })
      
      notifications.showError(
        '保存エラー',
        errorHandler.getLocalizedMessage(appError),
        [{
          label: '再試行',
          action: handleSave,
          style: 'primary' as const
        }]
      )
    }
  }



  const handleError = (err: Error) => {
    if (!isAppInitialized) {
      notifications.showError('エラー', 'アプリケーションが初期化されていません')
      return
    }

    const errorHandler = serviceRegistry.getErrorHandler() as any
    const appError = errorHandler.handleError(err, {
      component: 'App',
      operation: 'general'
    })
    
    notifications.showError(
      'エラー',
      errorHandler.getLocalizedMessage(appError)
    )
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'capture':
        return (
          <div className="view-content">
            <section className="capture-section">
              <CameraCapture 
                onImageCapture={handleImageCapture}
                onError={handleError}
              />
            </section>

            {imageData && (
              <section className="preview-section">
                <ImagePreview 
                  imageData={imageData}
                  onRegionSelect={() => setShowRegionSelector(true)}
                  onImageUpdate={setImageData}
                />
                
                {showRegionSelector && (
                  <RegionSelector
                    imageData={imageData}
                    onRegionConfirm={handleRegionSelect}
                    onCancel={() => setShowRegionSelector(false)}
                  />
                )}
              </section>
            )}

            {receiptData && (
              <section className="form-section">
                <ReceiptForm
                  receiptData={receiptData}
                  onDataChange={handleDataChange}
                  onSave={handleSave}
                />
              </section>
            )}
          </div>
        )
      
      case 'process':
        return (
          <div className="view-content">
            {imageData ? (
              <>
                <section className="preview-section">
                  <ImagePreview 
                    imageData={imageData}
                    onRegionSelect={() => setShowRegionSelector(true)}
                    onImageUpdate={setImageData}
                  />
                  
                  {showRegionSelector && (
                    <RegionSelector
                      imageData={imageData}
                      onRegionConfirm={handleRegionSelect}
                      onCancel={() => setShowRegionSelector(false)}
                    />
                  )}
                </section>

                {receiptData && (
                  <section className="form-section">
                    <ReceiptForm
                      receiptData={receiptData}
                      onDataChange={handleDataChange}
                      onSave={handleSave}
                    />
                  </section>
                )}
              </>
            ) : (
              <div className="empty-state">
                <h3>画像が選択されていません</h3>
                <p>「撮影」タブから画像を撮影または選択してください。</p>
                <button 
                  className="primary-button"
                  onClick={() => setCurrentView('capture')}
                >
                  撮影画面へ
                </button>
              </div>
            )}
          </div>
        )
      
      case 'history':
        return (
          <div className="view-content">
            <section className="history-section">
              <h2>処理履歴</h2>
              {receipts.length > 0 ? (
                <div className="receipts-list">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="receipt-item">
                      <div className="receipt-info">
                        <h4>{receipt.extractedData.payee.value || '支払先不明'}</h4>
                        <p>日付: {receipt.extractedData.date.value || '不明'}</p>
                        <p>金額: ¥{receipt.extractedData.amount.value || '0'}</p>
                        <p>処理日時: {receipt.createdAt.toLocaleString('ja-JP')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>処理履歴がありません</h3>
                  <p>領収書を処理すると、ここに履歴が表示されます。</p>
                </div>
              )}
            </section>
            
            <section className="export-section">
              <ExportPanel
                receipts={receipts}
                selectedReceipts={selectedReceipts}
                onSelectionChange={setSelectedReceipts}
                storage={isAppInitialized ? serviceRegistry.getStorage() : null}
              />
            </section>
          </div>
        )
      
      case 'settings':
        return (
          <div className="view-content">
            <section className="settings-section">
              <h2>設定</h2>
              {isAppInitialized ? (
                <>
                  <div className="settings-group">
                    <h3>OCR設定</h3>
                    <div className="setting-item">
                      <label>信頼度しきい値</label>
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.1" 
                        value={configManager.getOCRSettings().confidenceThreshold}
                        onChange={(e) => {
                          configManager.updateOCRSettings({
                            confidenceThreshold: parseFloat(e.target.value)
                          })
                        }}
                      />
                      <span>{configManager.getOCRSettings().confidenceThreshold}</span>
                    </div>
                  </div>
                  
                  <div className="settings-group">
                    <h3>表示設定</h3>
                    <div className="setting-item">
                      <label>
                        言語:
                        <select 
                          value={configManager.getUISettings().language}
                          onChange={(e) => {
                            configManager.updateUISettings({
                              language: e.target.value as 'ja' | 'en'
                            })
                          }}
                        >
                          <option value="ja">日本語</option>
                          <option value="en">English</option>
                        </select>
                      </label>
                    </div>
                    <div className="setting-item">
                      <label>
                        テーマ:
                        <select 
                          value={configManager.getUISettings().theme}
                          onChange={(e) => {
                            configManager.updateUISettings({
                              theme: e.target.value as 'light' | 'dark'
                            })
                          }}
                        >
                          <option value="light">ライト</option>
                          <option value="dark">ダーク</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <h3>エクスポート設定</h3>
                    <div className="setting-item">
                      <label>
                        デフォルト形式:
                        <select 
                          value={configManager.getExportSettings().defaultFormat}
                          onChange={(e) => {
                            configManager.updateExportSettings({
                              defaultFormat: e.target.value as 'json' | 'csv'
                            })
                          }}
                        >
                          <option value="json">JSON</option>
                          <option value="csv">CSV</option>
                        </select>
                      </label>
                    </div>
                    <div className="setting-item">
                      <label>
                        <input 
                          type="checkbox" 
                          checked={configManager.getExportSettings().includeMetadata}
                          onChange={(e) => {
                            configManager.updateExportSettings({
                              includeMetadata: e.target.checked
                            })
                          }}
                        />
                        メタデータを含める
                      </label>
                    </div>
                  </div>
                  
                  <div className="settings-group">
                    <h3>パフォーマンス</h3>
                    {performanceInfo && (
                      <div className="performance-info">
                        <div className="performance-item">
                          <label>アプリケーション状態:</label>
                          <span>{performanceInfo.registry?.initialized ? '初期化済み' : '未初期化'}</span>
                        </div>
                        <div className="performance-item">
                          <label>サービス数:</label>
                          <span>{performanceInfo.registry?.serviceCount || 0}</span>
                        </div>
                        {performanceInfo.memory && (
                          <div className="performance-item">
                            <label>メモリ使用量:</label>
                            <span>
                              {performanceInfo.memory?.usedJSHeapSize ? 
                                (serviceRegistry.getMemoryManager() as any).formatMemorySize(performanceInfo.memory.usedJSHeapSize) : 'N/A'} / 
                              {performanceInfo.memory?.jsHeapSizeLimit ? 
                                (serviceRegistry.getMemoryManager() as any).formatMemorySize(performanceInfo.memory.jsHeapSizeLimit) : 'N/A'}
                            </span>
                          </div>
                        )}
                        {performanceInfo.models && (
                          <div className="performance-item">
                            <label>モデルキャッシュ:</label>
                            <span>
                              {performanceInfo.models?.totalSize ? 
                                (serviceRegistry.getMemoryManager() as any).formatMemorySize(performanceInfo.models.totalSize) : 'N/A'} / 
                              {performanceInfo.models?.maxSize ? 
                                (serviceRegistry.getMemoryManager() as any).formatMemorySize(performanceInfo.models.maxSize) : 'N/A'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="performance-actions">
                      <button 
                        className="secondary-button"
                        onClick={async () => {
                          const ocrEngine = serviceRegistry.getOCREngine()
                          await ocrEngine.clearCache()
                          setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
                          notifications.showSuccess('キャッシュクリア', 'モデルキャッシュをクリアしました')
                        }}
                      >
                        モデルキャッシュをクリア
                      </button>
                      <button 
                        className="secondary-button"
                        onClick={async () => {
                          const ocrEngine = serviceRegistry.getOCREngine()
                          await ocrEngine.preloadModels()
                          setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
                          notifications.showSuccess('モデル読み込み', 'モデルを事前読み込みしました')
                        }}
                      >
                        モデルを事前読み込み
                      </button>
                      <button 
                        className="secondary-button"
                        onClick={async () => {
                          await serviceRegistry.restart()
                          setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
                          notifications.showSuccess('再起動完了', 'アプリケーションを再起動しました')
                        }}
                      >
                        アプリケーション再起動
                      </button>
                    </div>
                  </div>

                  <div className="settings-group">
                    <h3>データ管理</h3>
                    <div className="setting-actions">
                      <button 
                        className="secondary-button"
                        onClick={() => {
                          const config = configManager.exportConfig()
                          const blob = new Blob([config], { type: 'application/json' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = 'receipt-ocr-config.json'
                          a.click()
                          URL.revokeObjectURL(url)
                          notifications.showSuccess('エクスポート完了', '設定をエクスポートしました')
                        }}
                      >
                        設定をエクスポート
                      </button>
                      <button 
                        className="secondary-button"
                        onClick={() => {
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = '.json'
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (e) => {
                                const content = e.target?.result as string
                                if (configManager.importConfig(content)) {
                                  notifications.showSuccess('インポート完了', '設定をインポートしました')
                                  // Refresh performance info
                                  setPerformanceInfo(serviceRegistry.getPerformanceMetrics())
                                } else {
                                  notifications.showError('インポートエラー', '設定ファイルが無効です')
                                }
                              }
                              reader.readAsText(file)
                            }
                          }
                          input.click()
                        }}
                      >
                        設定をインポート
                      </button>
                      <button 
                        className="danger-button"
                        onClick={() => {
                          if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) {
                            const storage = serviceRegistry.getStorage()
                            storage.clearAll()
                            configManager.resetConfig()
                            setReceipts([])
                            notifications.showSuccess('削除完了', 'すべてのデータを削除しました')
                          }
                        }}
                      >
                        すべてのデータを削除
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="loading-state">
                  <p>アプリケーションを初期化中...</p>
                </div>
              )}
            </section>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">領収書OCR</h1>
          
          <button 
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="メニューを開く"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          
          <nav className={`main-nav ${isMobileMenuOpen ? 'nav-open' : ''}`}>
            <button 
              className={`nav-item ${currentView === 'capture' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('capture')
                setIsMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">📷</span>
              <span className="nav-label">撮影</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'process' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('process')
                setIsMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">処理</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('history')
                setIsMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-label">履歴</span>
            </button>
            
            <button 
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setCurrentView('settings')
                setIsMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-label">設定</span>
            </button>
            
            <button 
              className="nav-item"
              onClick={() => {
                openHelp()
                setIsMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">❓</span>
              <span className="nav-label">ヘルプ</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {renderCurrentView()}
      </main>
      
      <NotificationCenter position="top-right" />
      
      <HelpSystem 
        isOpen={isHelpOpen}
        onClose={closeHelp}
      />
      
      {isMobileMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App