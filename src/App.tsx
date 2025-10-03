import { useState, useEffect } from 'react'
import './App.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { NotificationCenter, useNotifications } from './components/NotificationCenter'
import { HelpSystem, useHelp } from './components/HelpSystem'
import { CameraCapture } from './components/CameraCapture'
import { ImagePreview } from './components/ImagePreview'
import { ReceiptForm } from './components/ReceiptForm'
import { ExportPanel } from './components/ExportPanel'
import { serviceRegistry } from './utils/serviceRegistry'
import { configManager } from './utils/configManager'
import { ReceiptStorage } from './utils/storage'
import { Rectangle, Receipt, ReceiptData } from './types'

function AppContent() {
  const [message, setMessage] = useState('サービス層を初期化中...')
  const [isInitialized, setIsInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [serviceStatus, setServiceStatus] = useState<any>(null)
  const [currentView, setCurrentView] = useState<'test' | 'capture' | 'data'>('test')
  const [currentImage, setCurrentImage] = useState<ImageData | null>(null)
  const [processingStep, setProcessingStep] = useState<string>('')
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null)
  const [currentReceiptData, setCurrentReceiptData] = useState<ReceiptData | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([])
  const [storage, setStorage] = useState<ReceiptStorage | null>(null)
  const notifications = useNotifications()
  const { isHelpOpen, openHelp, closeHelp } = useHelp()

  useEffect(() => {
    console.log('App component mounted')
    
    // Initialize service layer and storage
    const initializeServices = async () => {
      try {
        console.log('Starting service initialization...')
        
        // Initialize service registry
        await serviceRegistry.initialize()
        
        // Initialize storage
        const receiptStorage = new ReceiptStorage()
        await receiptStorage.initialize()
        setStorage(receiptStorage)
        
        // Load existing receipts
        const existingReceipts = await receiptStorage.getReceipts()
        setReceipts(existingReceipts)
        
        // Get initial status
        const status = serviceRegistry.getStatus()
        setServiceStatus(status)
        
        setMessage('サービス層とストレージの初期化が完了しました！')
        setIsInitialized(true)
        
        // Show welcome notification
        notifications.showSuccess(
          'アプリケーション開始',
          `領収書OCRアプリケーションが正常に起動しました（${existingReceipts.length}件の領収書を読み込み）`,
          5000
        )
        
        console.log('Service initialization completed:', status)
        console.log('Loaded receipts:', existingReceipts.length)
        
      } catch (error) {
        console.error('Service initialization failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setInitError(errorMessage)
        setMessage(`サービス初期化エラー: ${errorMessage}`)
        
        notifications.showError(
          '初期化エラー',
          `サービス層の初期化に失敗しました: ${errorMessage}`
        )
      }
    }
    
    initializeServices()
    
    return () => {
      console.log('App component unmounted')
      // Cleanup services
      serviceRegistry.destroy().catch(console.error)
    }
  }, [])

  // Image processing handlers
  const handleImageCapture = async (imageData: ImageData) => {
    try {
      console.log('Image captured:', imageData.width, 'x', imageData.height)
      setCurrentImage(imageData)
      setProcessingStep('画像が正常に読み込まれました')
      
      notifications.showSuccess(
        '画像読み込み完了',
        `${imageData.width}x${imageData.height}の画像が読み込まれました`,
        3000
      )

      // Auto-switch to capture view if we're in test mode
      if (currentView === 'test') {
        setCurrentView('capture')
      }

      // Automatically process the image with OCR
      await processImageWithOCR(imageData)

    } catch (error) {
      console.error('Image capture failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('画像読み込みエラー', errorMessage)
    }
  }

  // Process image with OCR and extract receipt data
  const processImageWithOCR = async (imageData: ImageData) => {
    if (!isInitialized) {
      notifications.showWarning('警告', 'OCRエンジンがまだ初期化されていません')
      return
    }

    try {
      setProcessingStep('OCR処理を開始中...')

      const progressId = notifications.showProgress(
        'OCR処理',
        '画像からテキストを抽出中...',
        0,
        '処理開始'
      )

      // Get OCR services
      const ocrEngine = serviceRegistry.getOCREngine()
      const dataExtractor = serviceRegistry.getDataExtractor()
      
      notifications.updateProgress(progressId, 25, 'OCRエンジンを準備中...', '準備')

      if (!ocrEngine.isInitialized()) {
        await ocrEngine.initialize()
      }

      notifications.updateProgress(progressId, 50, '画像を処理中...', '処理中')

      // Process the full image with OCR
      const ocrResults = await ocrEngine.processFullImage(imageData)
      
      notifications.updateProgress(progressId, 75, 'データを抽出中...', '抽出')

      // Extract receipt data
      const extractedData = dataExtractor.extractReceiptData(ocrResults)
      
      notifications.updateProgress(progressId, 100, 'OCR処理完了', '完了')

      console.log('OCR Results:', ocrResults)
      console.log('Extracted Data:', extractedData)
      
      setCurrentReceiptData(extractedData)
      
      // Create a new receipt object
      const newReceipt: Receipt = {
        id: `receipt_${Date.now()}`,
        imageData,
        extractedData,
        processingHistory: [{
          type: 'auto_ocr',
          timestamp: new Date()
        }],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      setCurrentReceipt(newReceipt)

      const extractedFields = [
        extractedData.date.value && `日付: ${extractedData.date.value}`,
        extractedData.payee.value && `支払先: ${extractedData.payee.value}`,
        extractedData.amount.value && `金額: ¥${extractedData.amount.value}`,
        extractedData.usage.value && `適用: ${extractedData.usage.value}`
      ].filter(Boolean).join('\n')

      notifications.showSuccess(
        'OCR処理完了',
        `領収書データを抽出しました:\n${extractedFields}`,
        8000
      )
      
      setProcessingStep('OCR処理が完了しました。データを確認してください。')

    } catch (error) {
      console.error('OCR processing failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('OCR処理エラー', errorMessage)
      setProcessingStep(`OCR処理エラー: ${errorMessage}`)
    }
  }

  const handleImageError = (error: Error) => {
    console.error('Image processing error:', error)
    notifications.showError('画像処理エラー', error.message)
    setProcessingStep(`エラー: ${error.message}`)
  }

  const handleRegionSelect = async (region: Rectangle, ocrResults?: any[]) => {
    if (!currentImage || !isInitialized) {
      notifications.showWarning('警告', 'OCRエンジンがまだ初期化されていません')
      return
    }

    try {
      console.log('Region selected:', region)
      setProcessingStep('選択領域でOCRを実行中...')

      const progressId = notifications.showProgress(
        '領域OCR処理',
        '選択された領域でOCRを実行中...',
        0,
        '処理開始'
      )

      // Get OCR engine from service registry
      const ocrEngine = serviceRegistry.getOCREngine()
      
      notifications.updateProgress(progressId, 25, 'OCRエンジンを準備中...', '準備')

      if (!ocrEngine.isInitialized()) {
        await ocrEngine.initialize()
      }

      notifications.updateProgress(progressId, 50, '領域を処理中...', '処理中')

      // Process the selected region
      const results = await ocrEngine.processRegion(currentImage, region)
      
      notifications.updateProgress(progressId, 100, 'OCR処理完了', '完了')

      console.log('Region OCR results:', results)
      
      if (results.length > 0) {
        const resultText = results.map(r => r.text).join(' ')
        notifications.showSuccess(
          '領域OCR完了',
          `抽出されたテキスト: "${resultText}"`,
          5000
        )
        setProcessingStep(`領域OCR完了: "${resultText}"`)
      } else {
        notifications.showWarning(
          '領域OCR完了',
          '選択された領域からテキストが検出されませんでした'
        )
        setProcessingStep('選択された領域からテキストが検出されませんでした')
      }

    } catch (error) {
      console.error('Region OCR failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('領域OCRエラー', errorMessage)
      setProcessingStep(`領域OCRエラー: ${errorMessage}`)
    }
  }

  const handleImageUpdate = (imageData: ImageData) => {
    console.log('Image updated:', imageData.width, 'x', imageData.height)
    setCurrentImage(imageData)
    setProcessingStep('画像が更新されました（透視補正適用済み）')
    
    // Update current receipt with new image data
    if (currentReceipt) {
      const updatedReceipt = {
        ...currentReceipt,
        imageData,
        updatedAt: new Date(),
        processingHistory: [
          ...currentReceipt.processingHistory,
          {
            type: 'user_edit' as const,
            timestamp: new Date(),
            field: 'image',
            oldValue: 'original',
            newValue: 'perspective_corrected'
          }
        ]
      }
      setCurrentReceipt(updatedReceipt)
    }
    
    notifications.showSuccess(
      '画像更新完了',
      '透視補正が適用されました',
      3000
    )
  }

  // Receipt data management handlers
  const handleReceiptDataChange = (data: ReceiptData) => {
    setCurrentReceiptData(data)
    
    if (currentReceipt) {
      const updatedReceipt = {
        ...currentReceipt,
        extractedData: data,
        updatedAt: new Date()
      }
      setCurrentReceipt(updatedReceipt)
    }
  }

  const handleReceiptSave = async () => {
    if (!currentReceipt || !storage) {
      notifications.showWarning('警告', '保存するデータがありません')
      return
    }

    try {
      setProcessingStep('領収書データを保存中...')
      
      // Add processing step for save
      const receiptToSave = {
        ...currentReceipt,
        processingHistory: [
          ...currentReceipt.processingHistory,
          {
            type: 'user_edit' as const,
            timestamp: new Date(),
            field: 'save',
            newValue: 'saved'
          }
        ]
      }

      await storage.saveReceipt(receiptToSave)
      
      // Update local receipts list
      const updatedReceipts = await storage.getReceipts()
      setReceipts(updatedReceipts)
      
      notifications.showSuccess(
        '保存完了',
        '領収書データが正常に保存されました',
        3000
      )
      
      setProcessingStep('領収書データが保存されました')
      
    } catch (error) {
      console.error('Save failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('保存エラー', errorMessage)
      setProcessingStep(`保存エラー: ${errorMessage}`)
    }
  }

  const handleReceiptLoad = async (receiptId: string) => {
    if (!storage) return

    try {
      const receipt = await storage.getReceipt(receiptId)
      if (receipt) {
        setCurrentReceipt(receipt)
        setCurrentReceiptData(receipt.extractedData)
        setCurrentImage(receipt.imageData)
        
        notifications.showSuccess(
          '読み込み完了',
          '領収書データを読み込みました',
          2000
        )
      }
    } catch (error) {
      console.error('Load failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('読み込みエラー', errorMessage)
    }
  }

  const handleReceiptDelete = async (receiptId: string) => {
    if (!storage) return

    try {
      await storage.deleteReceipt(receiptId)
      
      // Update local receipts list
      const updatedReceipts = await storage.getReceipts()
      setReceipts(updatedReceipts)
      
      // Clear current receipt if it was deleted
      if (currentReceipt?.id === receiptId) {
        setCurrentReceipt(null)
        setCurrentReceiptData(null)
        setCurrentImage(null)
      }
      
      notifications.showSuccess(
        '削除完了',
        '領収書データが削除されました',
        2000
      )
      
    } catch (error) {
      console.error('Delete failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('削除エラー', errorMessage)
    }
  }

  console.log('App component rendering...')

  const handleTestNotifications = () => {
    console.log('Testing notifications')
    setMessage('通知システムをテスト中...')
    
    // Test different notification types
    notifications.showSuccess('成功', 'テスト成功通知です', 3000)
    
    setTimeout(() => {
      notifications.showWarning('警告', 'テスト警告通知です', 4000)
    }, 1000)
    
    setTimeout(() => {
      notifications.showError('エラー', 'テストエラー通知です（永続）')
    }, 2000)
    
    setTimeout(() => {
      const progressId = notifications.showProgress('処理中', 'テスト処理を実行中...', 0, '初期化')
      
      // Simulate progress updates
      let progress = 0
      const interval = setInterval(() => {
        progress += 20
        notifications.updateProgress(
          progressId, 
          progress, 
          `処理中... ${progress}%`,
          progress < 50 ? '処理中' : '完了間近'
        )
        
        if (progress >= 100) {
          clearInterval(interval)
          setMessage('通知システムのテストが完了しました！')
        }
      }, 500)
    }, 3000)
  }

  const handleTestServices = () => {
    if (!isInitialized) {
      notifications.showWarning('警告', 'サービスがまだ初期化されていません')
      return
    }

    try {
      console.log('Testing services...')
      setMessage('サービス層をテスト中...')

      // Test config manager
      const config = configManager.getConfig()
      console.log('Current config:', config)

      // Test service registry
      const status = serviceRegistry.getStatus()
      console.log('Service status:', status)
      setServiceStatus(status)

      // Test performance metrics
      const metrics = serviceRegistry.getPerformanceMetrics()
      console.log('Performance metrics:', metrics)

      notifications.showSuccess(
        'サービステスト完了',
        `${status.serviceCount}個のサービスが正常に動作中`,
        4000
      )

      setMessage('サービス層のテストが完了しました！')

    } catch (error) {
      console.error('Service test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('サービステストエラー', errorMessage)
      setMessage(`サービステストエラー: ${errorMessage}`)
    }
  }

  const handleConfigTest = () => {
    if (!isInitialized) {
      notifications.showWarning('警告', 'サービスがまだ初期化されていません')
      return
    }

    try {
      console.log('Testing configuration...')
      
      // Get current config
      const currentConfig = configManager.getConfig()
      console.log('Current config:', currentConfig)

      // Test config update
      configManager.updateOCRSettings({
        confidenceThreshold: 0.75
      })

      // Verify update
      const updatedConfig = configManager.getConfig()
      console.log('Updated config:', updatedConfig)

      // Reset to default
      configManager.updateOCRSettings({
        confidenceThreshold: 0.8
      })

      notifications.showSuccess(
        '設定テスト完了',
        '設定の読み込み・更新・保存が正常に動作しました',
        4000
      )

      setMessage('設定システムのテストが完了しました！')

    } catch (error) {
      console.error('Config test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('設定テストエラー', errorMessage)
    }
  }

  const handleOCRTest = async () => {
    if (!isInitialized) {
      notifications.showWarning('警告', 'サービスがまだ初期化されていません')
      return
    }

    try {
      console.log('Testing OCR engines...')
      setMessage('OCRエンジンをテスト中...')

      const progressId = notifications.showProgress('OCRテスト', 'OCRエンジンを初期化中...', 0, '初期化')

      // Get OCR services
      const ocrEngine = serviceRegistry.getOCREngine()
      const dataExtractor = serviceRegistry.getDataExtractor()
      const normalizationEngine = serviceRegistry.getNormalizationEngine()

      // Test OCR engine initialization
      notifications.updateProgress(progressId, 25, 'OCRエンジンを初期化中...', '初期化')
      
      if (!ocrEngine.isInitialized()) {
        await ocrEngine.initialize()
      }

      // Test model info
      notifications.updateProgress(progressId, 50, 'モデル情報を取得中...', '情報取得')
      const modelInfo = ocrEngine.getModelInfo()
      console.log('OCR Model Info:', modelInfo)

      // Test data extraction with sample data
      notifications.updateProgress(progressId, 75, 'データ抽出をテスト中...', 'テスト実行')
      
      // Create sample OCR results for testing
      const sampleOCRResults = [
        {
          text: '2024/01/15',
          confidence: 0.9,
          bbox: { x: 10, y: 10, width: 100, height: 20 },
          candidates: ['2024/01/15']
        },
        {
          text: '株式会社テストストア',
          confidence: 0.85,
          bbox: { x: 10, y: 40, width: 200, height: 25 },
          candidates: ['株式会社テストストア']
        },
        {
          text: '合計 ¥1,500',
          confidence: 0.88,
          bbox: { x: 10, y: 200, width: 120, height: 20 },
          candidates: ['合計 ¥1,500']
        },
        {
          text: '会議用飲食代',
          confidence: 0.82,
          bbox: { x: 10, y: 100, width: 150, height: 20 },
          candidates: ['会議用飲食代']
        }
      ]

      // Test data extraction
      const extractedData = dataExtractor.extractReceiptData(sampleOCRResults)
      console.log('Extracted Data:', extractedData)

      // Test normalization
      const normalizedDate = normalizationEngine.normalizeDate(extractedData.date.value)
      const normalizedAmount = normalizationEngine.normalizeAmount(extractedData.amount.value)
      const normalizedPayee = normalizationEngine.normalizePayee(extractedData.payee.value)
      const normalizedUsage = normalizationEngine.normalizeUsage(extractedData.usage.value)

      console.log('Normalized Data:', {
        date: normalizedDate,
        amount: normalizedAmount,
        payee: normalizedPayee,
        usage: normalizedUsage
      })

      notifications.updateProgress(progressId, 100, 'OCRテスト完了', '完了')

      // Show results
      const resultMessage = `
        抽出結果:
        日付: ${extractedData.date.value} (信頼度: ${(extractedData.date.confidence * 100).toFixed(1)}%)
        支払先: ${extractedData.payee.value} (信頼度: ${(extractedData.payee.confidence * 100).toFixed(1)}%)
        金額: ${extractedData.amount.value} (信頼度: ${(extractedData.amount.confidence * 100).toFixed(1)}%)
        適用: ${extractedData.usage.value} (信頼度: ${(extractedData.usage.confidence * 100).toFixed(1)}%)
      `

      notifications.showSuccess(
        'OCRテスト完了',
        'OCRエンジン、データ抽出、正規化が正常に動作しました',
        6000
      )

      setMessage(`OCRエンジンのテストが完了しました！${resultMessage}`)

    } catch (error) {
      console.error('OCR test failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      notifications.showError('OCRテストエラー', errorMessage)
      setMessage(`OCRテストエラー: ${errorMessage}`)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">領収書OCR</h1>
          <nav className="main-nav">
            <button 
              className={`nav-item ${currentView === 'test' ? 'active' : ''}`}
              onClick={() => setCurrentView('test')}
            >
              <span className="nav-icon">🧪</span>
              <span className="nav-label">テスト</span>
            </button>
            <button 
              className={`nav-item ${currentView === 'capture' ? 'active' : ''}`}
              onClick={() => setCurrentView('capture')}
            >
              <span className="nav-icon">📷</span>
              <span className="nav-label">撮影</span>
            </button>
            <button 
              className={`nav-item ${currentView === 'data' ? 'active' : ''}`}
              onClick={() => setCurrentView('data')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-label">データ管理</span>
            </button>
          </nav>
          <div className="header-actions">
            <button 
              className="help-button"
              onClick={() => openHelp()}
              title="ヘルプ・ガイド"
            >
              <span className="help-icon">❓</span>
              <span className="help-label">ヘルプ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {currentView === 'test' && (
          <div className="view-content">
            <section className="capture-section">
              <h2>サービス層統合テスト</h2>
              <p>{message}</p>
            
            {initError && (
              <div style={{ 
                padding: '1rem', 
                background: '#fee', 
                border: '1px solid #fcc', 
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                color: '#c33'
              }}>
                <strong>初期化エラー:</strong> {initError}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button 
                className="primary-button"
                onClick={() => {
                  console.log('Button clicked')
                  setMessage('ボタンが正常に動作しています！')
                }}
              >
                基本テスト
              </button>
              
              <button 
                className="secondary-button"
                onClick={handleTestNotifications}
              >
                通知システムテスト
              </button>

              <button 
                className="primary-button"
                onClick={handleTestServices}
                disabled={!isInitialized}
              >
                サービス層テスト
              </button>

              <button 
                className="secondary-button"
                onClick={handleConfigTest}
                disabled={!isInitialized}
              >
                設定システムテスト
              </button>

              <button 
                className="primary-button"
                onClick={handleOCRTest}
                disabled={!isInitialized}
              >
                OCRエンジンテスト
              </button>
              
              <button 
                className="danger-button"
                onClick={() => {
                  // Test error boundary
                  throw new Error('テスト用エラー - ErrorBoundaryの動作確認')
                }}
              >
                エラーテスト
              </button>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '0.5rem' }}>
              <h3>統合済みコンポーネント</h3>
              <ul>
                <li>✅ NotificationCenter - 通知システム</li>
                <li>✅ ErrorBoundary - エラーハンドリング</li>
                <li>✅ 基本アプリケーションレイアウト</li>
                <li>{isInitialized ? '✅' : '⏳'} ServiceRegistry - サービスレジストリ</li>
                <li>{isInitialized ? '✅' : '⏳'} ConfigManager - 設定管理システム</li>
                <li>{isInitialized ? '✅' : '⏳'} OCREngine - PaddleOCR エンジン</li>
                <li>{isInitialized ? '✅' : '⏳'} DataExtractionEngine - データ抽出エンジン</li>
                <li>{isInitialized ? '✅' : '⏳'} NormalizationEngine - 正規化エンジン</li>
                <li>✅ CameraCapture - カメラ撮影機能</li>
                <li>✅ ImagePreview - 画像プレビュー機能</li>
                <li>✅ PerspectiveCorrector - 透視補正機能</li>
                <li>✅ ReceiptStorage - ローカルストレージ</li>
                <li>✅ ReceiptForm - 領収書データフォーム</li>
                <li>✅ ExportPanel - エクスポート機能</li>
              </ul>
            </div>

            {storage && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '0.5rem' }}>
                <h4>ストレージ状態</h4>
                <ul>
                  <li>保存済み領収書: {receipts.length}件</li>
                  <li>選択中: {selectedReceipts.length}件</li>
                  <li>現在の領収書: {currentReceipt ? 'あり' : 'なし'}</li>
                </ul>
              </div>
            )}

            {serviceStatus && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f8ff', borderRadius: '0.5rem' }}>
                <h4>サービス状態</h4>
                <ul>
                  <li>初期化済み: {serviceStatus.initialized ? 'はい' : 'いいえ'}</li>
                  <li>サービス数: {serviceStatus.serviceCount}</li>
                  <li>登録済みサービス: {serviceStatus.services.join(', ')}</li>
                </ul>
              </div>
            )}
          </section>
        </div>
        )}

        {currentView === 'capture' && (
          <div className="view-content">
            <section className="capture-section">
              <CameraCapture 
                onImageCapture={handleImageCapture}
                onError={handleImageError}
              />
              {processingStep && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '0.75rem', 
                  background: '#e7f3ff', 
                  borderRadius: '0.5rem',
                  color: '#0066cc',
                  fontWeight: '500'
                }}>
                  {processingStep}
                </div>
              )}
            </section>
            
            <section className="preview-section">
              <ImagePreview 
                imageData={currentImage}
                onRegionSelect={handleRegionSelect}
                onImageUpdate={handleImageUpdate}
              />
            </section>

            <section className="form-section">
              <ReceiptForm 
                receiptData={currentReceiptData}
                onDataChange={handleReceiptDataChange}
                onSave={handleReceiptSave}
              />
            </section>
          </div>
        )}

        {currentView === 'data' && (
          <div className="view-content">
            <section className="data-management-section">
              <h2>データ管理</h2>
              
              <div className="data-summary">
                <div className="summary-card">
                  <h3>保存済み領収書</h3>
                  <div className="summary-value">{receipts.length}件</div>
                </div>
                <div className="summary-card">
                  <h3>選択中</h3>
                  <div className="summary-value">{selectedReceipts.length}件</div>
                </div>
              </div>

              <div className="receipt-list-section">
                <h3>領収書一覧</h3>
                {receipts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📄</div>
                    <h4>保存された領収書がありません</h4>
                    <p>撮影画面で領収書を処理して保存してください。</p>
                  </div>
                ) : (
                  <div className="receipt-grid">
                    {receipts.map(receipt => (
                      <div key={receipt.id} className="receipt-card">
                        <div className="receipt-header">
                          <input
                            type="checkbox"
                            checked={selectedReceipts.includes(receipt.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReceipts([...selectedReceipts, receipt.id])
                              } else {
                                setSelectedReceipts(selectedReceipts.filter(id => id !== receipt.id))
                              }
                            }}
                          />
                          <span className="receipt-date">
                            {new Date(receipt.createdAt).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                        <div className="receipt-info">
                          <div className="receipt-field">
                            <strong>日付:</strong> {receipt.extractedData.date.value || '未設定'}
                          </div>
                          <div className="receipt-field">
                            <strong>支払先:</strong> {receipt.extractedData.payee.value || '未設定'}
                          </div>
                          <div className="receipt-field">
                            <strong>金額:</strong> ¥{receipt.extractedData.amount.value || '0'}
                          </div>
                          <div className="receipt-field">
                            <strong>適用:</strong> {receipt.extractedData.usage.value || '未設定'}
                          </div>
                        </div>
                        <div className="receipt-actions">
                          <button 
                            className="load-button"
                            onClick={() => {
                              handleReceiptLoad(receipt.id)
                              setCurrentView('capture')
                            }}
                          >
                            📝 編集
                          </button>
                          <button 
                            className="delete-button"
                            onClick={() => {
                              if (confirm('この領収書を削除しますか？')) {
                                handleReceiptDelete(receipt.id)
                              }
                            }}
                          >
                            🗑️ 削除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="export-section">
                <ExportPanel 
                  receipts={receipts}
                  selectedReceipts={selectedReceipts}
                  onSelectionChange={setSelectedReceipts}
                  storage={storage}
                />
              </div>
            </section>
          </div>
        )}
      </main>
      
      {/* Help System */}
      <HelpSystem isOpen={isHelpOpen} onClose={closeHelp} />
      
      {/* Notification Center */}
      <NotificationCenter position="top-right" maxVisible={5} />
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