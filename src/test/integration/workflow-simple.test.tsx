import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock all dependencies before importing App
vi.mock('../../engines/OCREngine', () => ({
  PaddleOCREngine: vi.fn().mockImplementation(() => ({
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
        text: 'テスト株式会社',
        confidence: 0.92,
        bbox: { x: 50, y: 80, width: 150, height: 25 },
        candidates: ['テスト株式会社']
      },
      {
        text: '¥1,000',
        confidence: 0.88,
        bbox: { x: 150, y: 200, width: 60, height: 20 },
        candidates: ['¥1,000']
      }
    ]),
    clearCache: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    getPerformanceInfo: vi.fn().mockReturnValue({
      modelCache: { totalSize: 1024, maxSize: 2048, modelCount: 2 },
      webWorker: true
    })
  }))
}))

vi.mock('../../engines/DataExtractionEngine', () => ({
  ReceiptDataExtractor: vi.fn().mockImplementation(() => ({
    extractReceiptData: vi.fn().mockReturnValue({
      date: { value: '2024/01/15', confidence: 0.95, candidates: ['2024/01/15'] },
      payee: { value: 'テスト株式会社', confidence: 0.92, candidates: ['テスト株式会社'] },
      amount: { value: '1000', confidence: 0.88, candidates: ['1000'] },
      usage: { value: '飲食代', confidence: 0.85, candidates: ['飲食代'] },
      metadata: { processedAt: new Date(), imageHash: 'test-hash' }
    })
  }))
}))

vi.mock('../../utils/storage', () => ({
  ReceiptStorage: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockResolvedValue(undefined),
    getReceipts: vi.fn().mockResolvedValue([]),
    exportToJSON: vi.fn().mockResolvedValue(new Blob(['{}'], { type: 'application/json' })),
    exportToCSV: vi.fn().mockResolvedValue(new Blob([''], { type: 'text/csv' }))
  }))
}))

import App from '../../App'

describe('Simplified Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the main application', async () => {
    render(<App />)

    // Wait for app initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Check main navigation elements
    expect(screen.getByText('撮影')).toBeInTheDocument()
    expect(screen.getByText('処理')).toBeInTheDocument()
    expect(screen.getByText('履歴')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('should navigate between different views', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Navigate to history view
    const historyTab = screen.getByText('履歴')
    await user.click(historyTab)

    expect(screen.getByText('処理履歴')).toBeInTheDocument()

    // Navigate to settings view
    const settingsTab = screen.getByText('設定')
    await user.click(settingsTab)

    expect(screen.getByText('OCR設定')).toBeInTheDocument()

    // Navigate back to capture view
    const captureTab = screen.getByText('撮影')
    await user.click(captureTab)

    // Should be back to capture view
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument()
  })

  it('should handle mobile menu functionality', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Find and click mobile menu toggle
    const menuToggle = screen.getByLabelText('メニューを開く')
    await user.click(menuToggle)

    // Menu should be open
    const navigation = screen.getByRole('navigation')
    expect(navigation).toHaveClass('nav-open')

    // Click on a menu item
    const historyMenuItem = screen.getByText('履歴')
    await user.click(historyMenuItem)

    // Should navigate and close menu
    expect(screen.getByText('処理履歴')).toBeInTheDocument()
  })

  it('should display file input for image capture', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Check for file input
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', 'image/*')
    expect(fileInput).toHaveAttribute('capture', 'environment')
  })

  it('should show help system', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Open help
    const helpButton = screen.getByText('ヘルプ')
    await user.click(helpButton)

    // Help system should be visible
    await waitFor(() => {
      const helpDialog = document.querySelector('[role="dialog"]') || 
                       document.querySelector('.help-system')
      expect(helpDialog).toBeInTheDocument()
    })
  })

  it('should handle settings and performance features', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Navigate to settings
    const settingsTab = screen.getByText('設定')
    await user.click(settingsTab)

    expect(screen.getByText('OCR設定')).toBeInTheDocument()

    // Check for performance controls
    expect(screen.getByText('モデルキャッシュをクリア')).toBeInTheDocument()
    expect(screen.getByText('モデルを事前読み込み')).toBeInTheDocument()
  })

  it('should show export functionality in history view', async () => {
    const user = userEvent.setup()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Navigate to history
    const historyTab = screen.getByText('履歴')
    await user.click(historyTab)

    expect(screen.getByText('処理履歴')).toBeInTheDocument()

    // Should show export section
    expect(screen.getByText('データエクスポート')).toBeInTheDocument()
  })
})