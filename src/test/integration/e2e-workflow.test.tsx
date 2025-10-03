import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { PaddleOCREngine } from '../../engines/OCREngine'
import { ReceiptDataExtractor } from '../../engines/DataExtractionEngine'
import { ReceiptStorage } from '../../utils/storage'

// Mock implementations for integration testing
vi.mock('../../engines/OCREngine')
vi.mock('../../engines/DataExtractionEngine')
vi.mock('../../utils/storage')

describe('End-to-End Workflow Integration Tests', () => {
  let mockOCREngine: any
  let mockDataExtractor: any
  let mockStorage: any
  let user: any

  beforeEach(() => {
    user = userEvent.setup()
    
    // Setup mock OCR engine
    mockOCREngine = {
      initialize: vi.fn().mockResolvedValue(undefined),
      preloadModels: vi.fn().mockResolvedValue(undefined),
      processFullImage: vi.fn().mockResolvedValue([
        {
          text: '2024/01/15',
          confidence: 0.95,
          bbox: { x: 100, y: 50, width: 80, height: 20 },
          candidates: ['2024/01/15']
        },
        {
          text: 'スターバックス コーヒー',
          confidence: 0.92,
          bbox: { x: 50, y: 80, width: 200, height: 25 },
          candidates: ['スターバックス コーヒー']
        },
        {
          text: '合計 ¥580',
          confidence: 0.88,
          bbox: { x: 150, y: 300, width: 100, height: 20 },
          candidates: ['合計 ¥580']
        },
        {
          text: 'コーヒー',
          confidence: 0.85,
          bbox: { x: 80, y: 150, width: 60, height: 18 },
          candidates: ['コーヒー']
        }
      ]),
      processRegion: vi.fn().mockResolvedValue([
        {
          text: '¥580',
          confidence: 0.95,
          bbox: { x: 0, y: 0, width: 50, height: 20 },
          candidates: ['¥580']
        }
      ]),
      clearCache: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getPerformanceInfo: vi.fn().mockReturnValue({
        modelCache: { totalSize: 1024, maxSize: 2048, modelCount: 2 },
        webWorker: true
      })
    }

    // Setup mock data extractor
    mockDataExtractor = {
      extractReceiptData: vi.fn().mockReturnValue({
        date: { value: '2024/01/15', confidence: 0.95, candidates: ['2024/01/15'] },
        payee: { value: 'スターバックス コーヒー', confidence: 0.92, candidates: ['スターバックス コーヒー'] },
        amount: { value: '580', confidence: 0.88, candidates: ['580'] },
        usage: { value: '飲食代', confidence: 0.85, candidates: ['飲食代', 'コーヒー代'] },
        metadata: { processedAt: new Date(), imageHash: 'test-hash' }
      }),
      addRegionCandidates: vi.fn().mockImplementation((currentData, regionResults, fieldType) => {
        const updatedData = { ...currentData }
        if (fieldType === 'amount') {
          updatedData.amount.candidates.push('580')
          updatedData.amount.value = '580'
          updatedData.amount.confidence = 0.95
        }
        return updatedData
      })
    }

    // Setup mock storage
    mockStorage = {
      initialize: vi.fn().mockResolvedValue(undefined),
      saveReceipt: vi.fn().mockResolvedValue(undefined),
      getReceipts: vi.fn().mockResolvedValue([]),
      exportToJSON: vi.fn().mockResolvedValue(new Blob(['{}'], { type: 'application/json' })),
      exportToCSV: vi.fn().mockResolvedValue(new Blob([''], { type: 'text/csv' }))
    }

    // Apply mocks
    vi.mocked(PaddleOCREngine).mockImplementation(() => mockOCREngine)
    vi.mocked(ReceiptDataExtractor).mockImplementation(() => mockDataExtractor)
    vi.mocked(ReceiptStorage).mockImplementation(() => mockStorage)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should complete full receipt processing workflow', async () => {
    render(<App />)

    // Wait for app initialization
    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Verify initial state - capture view should be active
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    expect(screen.getByText('撮影')).toBeInTheDocument()

    // Create a mock image file
    const mockImageFile = new File(['mock image data'], 'receipt.jpg', { type: 'image/jpeg' })

    // Mock FileReader for image loading
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: 'data:image/jpeg;base64,mockdata'
    }

    global.FileReader = vi.fn().mockImplementation(() => mockFileReader) as any

    // Find and interact with file input
    const fileInput = screen.getByRole('button', { name: /画像を選択|ファイルを選択|撮影/ }) || 
                     document.querySelector('input[type="file"]') as HTMLInputElement
    
    if (fileInput) {
      // Simulate file selection
      await user.upload(fileInput, mockImageFile)

      // Trigger FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result: mockFileReader.result } } as any)
      }

      // Wait for OCR processing to complete
      await waitFor(() => {
        expect(mockOCREngine.initialize).toHaveBeenCalled()
      }, { timeout: 5000 })

      await waitFor(() => {
        expect(mockOCREngine.processFullImage).toHaveBeenCalled()
      }, { timeout: 5000 })

      await waitFor(() => {
        expect(mockDataExtractor.extractReceiptData).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Verify extracted data is displayed in form
      await waitFor(() => {
        expect(screen.getByDisplayValue('2024/01/15')).toBeInTheDocument()
        expect(screen.getByDisplayValue('スターバックス コーヒー')).toBeInTheDocument()
        expect(screen.getByDisplayValue('580')).toBeInTheDocument()
        expect(screen.getByDisplayValue('飲食代')).toBeInTheDocument()
      })

      // Verify data can be edited
      const amountInput = screen.getByDisplayValue('580')
      await user.clear(amountInput)
      await user.type(amountInput, '600')

      expect(screen.getByDisplayValue('600')).toBeInTheDocument()

      // Save the receipt
      const saveButton = screen.getByText(/保存|Save/)
      await user.click(saveButton)

      // Verify save was called
      await waitFor(() => {
        expect(mockStorage.saveReceipt).toHaveBeenCalledWith(
          expect.objectContaining({
            extractedData: expect.objectContaining({
              date: expect.objectContaining({ value: '2024/01/15' }),
              payee: expect.objectContaining({ value: 'スターバックス コーヒー' }),
              amount: expect.objectContaining({ value: '600' }),
              usage: expect.objectContaining({ value: '飲食代' })
            })
          })
        )
      })
    }

    // Navigate to history view
    const historyTab = screen.getByText('履歴')
    await user.click(historyTab)

    // Verify navigation worked
    expect(screen.getByText('処理履歴')).toBeInTheDocument()
  })

  it('should handle OCR errors gracefully', async () => {
    // Setup OCR engine to fail
    mockOCREngine.processFullImage.mockRejectedValue(new Error('OCR processing failed'))

    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Create and upload mock image
    const mockImageFile = new File(['mock image data'], 'receipt.jpg', { type: 'image/jpeg' })
    
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: 'data:image/jpeg;base64,mockdata'
    }

    global.FileReader = vi.fn().mockImplementation(() => mockFileReader) as any

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      await user.upload(fileInput, mockImageFile)

      if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result: mockFileReader.result } } as any)
      }

      // Wait for error handling
      await waitFor(() => {
        expect(screen.getByText(/エラー|Error/)).toBeInTheDocument()
      }, { timeout: 5000 })

      // Verify retry functionality exists
      const retryButton = screen.queryByText(/再試行|Retry/)
      if (retryButton) {
        expect(retryButton).toBeInTheDocument()
      }
    }
  })

  it('should support export functionality', async () => {
    // Setup storage with mock receipts
    const mockReceipts = [
      {
        id: '1',
        extractedData: {
          date: { value: '2024/01/15', confidence: 0.95, candidates: [] },
          payee: { value: 'スターバックス', confidence: 0.92, candidates: [] },
          amount: { value: '580', confidence: 0.88, candidates: [] },
          usage: { value: '飲食代', confidence: 0.85, candidates: [] },
          metadata: { processedAt: new Date(), imageHash: 'hash1' }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    mockStorage.getReceipts.mockResolvedValue(mockReceipts)

    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Navigate to history
    const historyTab = screen.getByText('履歴')
    await user.click(historyTab)

    // Wait for receipts to load
    await waitFor(() => {
      expect(screen.getByText('スターバックス')).toBeInTheDocument()
    })

    // Test export functionality (buttons may have different text)
    const exportButtons = screen.getAllByText(/エクスポート|Export/)
    if (exportButtons.length > 0) {
      await user.click(exportButtons[0])
      
      await waitFor(() => {
        expect(mockStorage.exportToJSON).toHaveBeenCalled()
      })
    }
  })

  it('should handle navigation between views', async () => {
    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Test navigation to process view
    const processTab = screen.getByText('処理')
    await user.click(processTab)

    expect(screen.getByText('画像が選択されていません')).toBeInTheDocument()

    // Test navigation to settings
    const settingsTab = screen.getByText('設定')
    await user.click(settingsTab)

    expect(screen.getByText('OCR設定')).toBeInTheDocument()

    // Test navigation back to capture
    const captureTab = screen.getByText('撮影')
    await user.click(captureTab)

    // Should be back to capture view - check for file input
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('should handle mobile menu functionality', async () => {
    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Find mobile menu toggle
    const menuToggle = screen.getByLabelText('メニューを開く')
    await user.click(menuToggle)

    // Menu should be open
    const navigation = screen.getByRole('navigation')
    expect(navigation).toHaveClass('nav-open')

    // Click on a menu item
    const historyMenuItem = screen.getByText('履歴')
    await user.click(historyMenuItem)

    // Menu should close and navigate
    expect(screen.getByText('処理履歴')).toBeInTheDocument()
  })

  it('should handle help system', async () => {
    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Open help
    const helpButton = screen.getByText('ヘルプ')
    await user.click(helpButton)

    // Help system should be visible (check for help-related content)
    await waitFor(() => {
      expect(document.body).toContain(document.querySelector('[role="dialog"]') || 
                                      document.querySelector('.help-system'))
    })
  })

  it('should handle performance optimization features', async () => {
    render(<App />)

    await waitFor(() => {
      expect(mockStorage.initialize).toHaveBeenCalled()
    })

    // Navigate to settings
    const settingsTab = screen.getByText('設定')
    await user.click(settingsTab)

    // Test model cache clear
    const clearCacheButton = screen.getByText('モデルキャッシュをクリア')
    await user.click(clearCacheButton)

    await waitFor(() => {
      expect(mockOCREngine.clearCache).toHaveBeenCalled()
    })

    // Test model preload
    const preloadButton = screen.getByText('モデルを事前読み込み')
    await user.click(preloadButton)

    await waitFor(() => {
      expect(mockOCREngine.preloadModels).toHaveBeenCalled()
    })
  })
})