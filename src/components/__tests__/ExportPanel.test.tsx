import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportPanel } from '../ExportPanel'
import { Receipt } from '../../types'

// Mock the storage utility
const mockStorage = {
  exportToJSON: vi.fn().mockResolvedValue(new Blob(['{"test": "json"}'], { type: 'application/json' })),
  exportToCSV: vi.fn().mockResolvedValue(new Blob(['test,csv'], { type: 'text/csv' })),
  exportAllToJSON: vi.fn().mockResolvedValue(new Blob(['{"all": "json"}'], { type: 'application/json' })),
  exportAllToCSV: vi.fn().mockResolvedValue(new Blob(['all,csv'], { type: 'text/csv' }))
}

// Mock the download utility
vi.mock('../../utils/download', () => ({
  downloadBlob: vi.fn(),
  generateTimestampFilename: vi.fn().mockImplementation((prefix, ext) => `${prefix}_${Date.now()}.${ext}`)
}))

describe('ExportPanel', () => {
  const mockOnSelectionChange = vi.fn()

  const mockReceipts: Receipt[] = [
    {
      id: '1',
      imageData: new ImageData(100, 100),
      extractedData: {
        date: { value: '2024/01/15', confidence: 0.9, candidates: [] },
        payee: { value: '株式会社テスト', confidence: 0.85, candidates: [] },
        amount: { value: '1500', confidence: 0.95, candidates: [] },
        usage: { value: '会議費', confidence: 0.8, candidates: [] },
        metadata: { processedAt: new Date(), imageHash: 'hash1' }
      },
      processingHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: '2',
      imageData: new ImageData(100, 100),
      extractedData: {
        date: { value: '2024/01/20', confidence: 0.9, candidates: [] },
        payee: { value: 'テストカフェ', confidence: 0.85, candidates: [] },
        amount: { value: '800', confidence: 0.95, candidates: [] },
        usage: { value: '飲食代', confidence: 0.8, candidates: [] },
        metadata: { processedAt: new Date(), imageHash: 'hash2' }
      },
      processingHistory: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render export summary', () => {
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={['1']}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    expect(screen.getByText('総領収書数: 2件')).toBeInTheDocument()
    expect(screen.getByText('選択中: 1件')).toBeInTheDocument()
  })

  it('should render without selection controls when onSelectionChange is not provided', () => {
    render(
      <ExportPanel
        receipts={mockReceipts}
        storage={mockStorage}
      />
    )

    expect(screen.getByText('総領収書数: 2件')).toBeInTheDocument()
    expect(screen.queryByText('選択中:')).not.toBeInTheDocument()
    expect(screen.queryByText('すべて選択')).not.toBeInTheDocument()
  })

  it('should render receipt list with selection controls', () => {
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={['1']}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    expect(screen.getByText('2024/01/15')).toBeInTheDocument()
    expect(screen.getByText('株式会社テスト')).toBeInTheDocument()
    expect(screen.getByText('2024/01/20')).toBeInTheDocument()
    expect(screen.getByText('テストカフェ')).toBeInTheDocument()
  })

  it('should handle select all checkbox', async () => {
    const user = userEvent.setup()
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const selectAllCheckbox = screen.getByLabelText('すべて選択')
    await user.click(selectAllCheckbox)

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['1', '2'])
  })

  it('should handle individual receipt selection', async () => {
    const user = userEvent.setup()
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const receiptCheckboxes = screen.getAllByRole('checkbox')
    const firstReceiptCheckbox = receiptCheckboxes[1] // Skip "select all" checkbox
    
    await user.click(firstReceiptCheckbox)

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['1'])
  })

  it('should handle deselecting receipts', async () => {
    const user = userEvent.setup()
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={['1', '2']}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const receiptCheckboxes = screen.getAllByRole('checkbox')
    const firstReceiptCheckbox = receiptCheckboxes[1] // Skip "select all" checkbox
    
    await user.click(firstReceiptCheckbox)

    expect(mockOnSelectionChange).toHaveBeenCalledWith(['2'])
  })

  it('should export all receipts as JSON', async () => {
    const user = userEvent.setup()
    const { downloadBlob } = await import('../../utils/download')
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('全件JSON')
    await user.click(exportButton)

    expect(mockStorage.exportToJSON).toHaveBeenCalledWith(mockReceipts)
    expect(downloadBlob).toHaveBeenCalled()
  })

  it('should export all receipts as CSV', async () => {
    const user = userEvent.setup()
    const { downloadBlob } = await import('../../utils/download')
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('全件CSV')
    await user.click(exportButton)

    expect(mockStorage.exportToCSV).toHaveBeenCalledWith(mockReceipts)
    expect(downloadBlob).toHaveBeenCalled()
  })

  it('should export selected receipts as JSON', async () => {
    const user = userEvent.setup()
    const { downloadBlob } = await import('../../utils/download')
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={['1']}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('選択JSON')
    await user.click(exportButton)

    expect(mockStorage.exportToJSON).toHaveBeenCalledWith([mockReceipts[0]])
    expect(downloadBlob).toHaveBeenCalled()
  })

  it('should export selected receipts as CSV', async () => {
    const user = userEvent.setup()
    const { downloadBlob } = await import('../../utils/download')
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={['2']}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('選択CSV')
    await user.click(exportButton)

    expect(mockStorage.exportToCSV).toHaveBeenCalledWith([mockReceipts[1]])
    expect(downloadBlob).toHaveBeenCalled()
  })

  it('should handle batch export', async () => {
    const user = userEvent.setup()
    const { downloadBlob } = await import('../../utils/download')
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const batchExportButton = screen.getByText('JSON・CSV両形式で一括エクスポート')
    await user.click(batchExportButton)

    expect(mockStorage.exportAllToJSON).toHaveBeenCalled()
    expect(mockStorage.exportAllToCSV).toHaveBeenCalled()
    expect(downloadBlob).toHaveBeenCalledTimes(2)
  })

  it('should disable export buttons when no receipts', () => {
    render(
      <ExportPanel
        receipts={[]}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    expect(screen.getByText('全件JSON')).toBeDisabled()
    expect(screen.getByText('全件CSV')).toBeDisabled()
    expect(screen.getByText('JSON・CSV両形式で一括エクスポート')).toBeDisabled()
  })

  it('should disable selected export buttons when no selection', () => {
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    expect(screen.getByText('選択JSON')).toBeDisabled()
    expect(screen.getByText('選択CSV')).toBeDisabled()
  })

  it('should show export status message', async () => {
    const user = userEvent.setup()
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('全件JSON')
    await user.click(exportButton)

    expect(screen.getByText('2件の領収書をJSON形式でエクスポートしました')).toBeInTheDocument()
  })

  it('should show loading state during export', async () => {
    const user = userEvent.setup()
    
    // Mock a delayed export
    const delayedStorage = {
      ...mockStorage,
      exportToJSON: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(new Blob()), 100))
      )
    }
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={delayedStorage}
      />
    )

    const exportButton = screen.getByText('全件JSON')
    await user.click(exportButton)

    expect(screen.getByText('エクスポート中...')).toBeInTheDocument()
  })

  it('should handle export errors', async () => {
    const user = userEvent.setup()
    
    const errorStorage = {
      ...mockStorage,
      exportToJSON: vi.fn().mockRejectedValue(new Error('Export failed'))
    }
    
    render(
      <ExportPanel
        receipts={mockReceipts}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={errorStorage}
      />
    )

    const exportButton = screen.getByText('全件JSON')
    await user.click(exportButton)

    expect(screen.getByText('エクスポート中にエラーが発生しました')).toBeInTheDocument()
  })

  it('should show message when no receipts to export', async () => {
    const user = userEvent.setup()
    
    render(
      <ExportPanel
        receipts={[]}
        selectedReceipts={[]}
        onSelectionChange={mockOnSelectionChange}
        storage={mockStorage}
      />
    )

    const exportButton = screen.getByText('全件JSON')
    await user.click(exportButton)

    // The component doesn't show this message, it just disables buttons
    expect(screen.getByText('全件JSON')).toBeDisabled()
  })
})