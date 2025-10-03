import React, { useState, useCallback } from 'react'
import { Receipt } from '../types'
import { ReceiptStorage } from '../utils/storage'
import { downloadBlob, generateTimestampFilename } from '../utils/download'

interface ExportPanelProps {
  receipts: Receipt[]
  selectedReceipts?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
  storage: ReceiptStorage | null | any
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ 
  receipts, 
  selectedReceipts = [], 
  onSelectionChange,
  storage 
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<string>('')
  const [selectAll, setSelectAll] = useState(false)

  const handleSelectAll = useCallback(() => {
    if (onSelectionChange) {
      if (selectAll) {
        onSelectionChange([])
      } else {
        onSelectionChange(receipts.map(r => r.id))
      }
      setSelectAll(!selectAll)
    }
  }, [selectAll, receipts, onSelectionChange])

  const handleReceiptSelection = useCallback((receiptId: string, checked: boolean) => {
    if (onSelectionChange) {
      if (checked) {
        onSelectionChange([...selectedReceipts, receiptId])
      } else {
        onSelectionChange(selectedReceipts.filter(id => id !== receiptId))
        setSelectAll(false)
      }
    }
  }, [selectedReceipts, onSelectionChange])



  const handleExport = useCallback(async (format: 'json' | 'csv', exportType: 'selected' | 'all') => {
    if (!storage) {
      setExportStatus('ストレージが初期化されていません')
      return
    }

    setIsExporting(true)
    setExportStatus('')

    try {
      let receiptsToExport: Receipt[]
      let filename: string

      if (exportType === 'all') {
        receiptsToExport = receipts
        filename = generateTimestampFilename('receipts_all', format)
      } else {
        receiptsToExport = receipts.filter(r => selectedReceipts.includes(r.id))
        filename = generateTimestampFilename('receipts_selected', format)
      }

      if (receiptsToExport.length === 0) {
        setExportStatus('エクスポートする領収書がありません')
        return
      }

      let blob: Blob
      if (format === 'json') {
        blob = await storage.exportToJSON(receiptsToExport)
      } else {
        blob = await storage.exportToCSV(receiptsToExport)
      }

      downloadBlob(blob, filename)
      setExportStatus(`${receiptsToExport.length}件の領収書を${format.toUpperCase()}形式でエクスポートしました`)
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus('エクスポート中にエラーが発生しました')
    } finally {
      setIsExporting(false)
    }
  }, [receipts, selectedReceipts, storage, downloadBlob])

  const handleBatchExportAll = useCallback(async () => {
    setIsExporting(true)
    setExportStatus('')

    try {
      // Export both JSON and CSV
      const [jsonBlob, csvBlob] = await Promise.all([
        storage!.exportAllToJSON(),
        storage!.exportAllToCSV()
      ])

      downloadBlob(jsonBlob, generateTimestampFilename('receipts_all', 'json'))
      downloadBlob(csvBlob, generateTimestampFilename('receipts_all', 'csv'))

      setExportStatus(`${receipts.length}件の領収書をJSON・CSV両形式でエクスポートしました`)
    } catch (error) {
      console.error('Batch export error:', error)
      setExportStatus('バッチエクスポート中にエラーが発生しました')
    } finally {
      setIsExporting(false)
    }
  }, [receipts.length, storage, downloadBlob])

  const selectedCount = selectedReceipts.length
  const hasSelection = selectedCount > 0

  return (
    <div className="export-panel">
      <h3>データエクスポート</h3>
      
      <div className="export-summary">
        <p>総領収書数: {receipts.length}件</p>
        {onSelectionChange && (
          <p>選択中: {selectedCount}件</p>
        )}
      </div>

      {onSelectionChange && receipts.length > 0 && (
        <div className="receipt-selection">
          <div className="selection-controls">
            <label>
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
              />
              すべて選択
            </label>
          </div>
          
          <div className="receipt-list">
            {receipts.map(receipt => (
              <div key={receipt.id} className="receipt-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedReceipts.includes(receipt.id)}
                    onChange={(e) => handleReceiptSelection(receipt.id, e.target.checked)}
                  />
                  <span className="receipt-info">
                    {receipt.extractedData.date.value || '日付不明'} - 
                    {receipt.extractedData.payee.value || '支払先不明'} - 
                    ¥{receipt.extractedData.amount.value || '0'}
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="export-actions">
        <div className="export-section">
          <h4>個別エクスポート</h4>
          <div className="export-buttons">
            <button 
              onClick={() => handleExport('json', 'all')}
              disabled={isExporting || receipts.length === 0}
            >
              全件JSON
            </button>
            <button 
              onClick={() => handleExport('csv', 'all')}
              disabled={isExporting || receipts.length === 0}
            >
              全件CSV
            </button>
            {onSelectionChange && (
              <>
                <button 
                  onClick={() => handleExport('json', 'selected')}
                  disabled={isExporting || !hasSelection}
                >
                  選択JSON
                </button>
                <button 
                  onClick={() => handleExport('csv', 'selected')}
                  disabled={isExporting || !hasSelection}
                >
                  選択CSV
                </button>
              </>
            )}
          </div>
        </div>

        <div className="export-section">
          <h4>バッチエクスポート</h4>
          <button 
            onClick={handleBatchExportAll}
            disabled={isExporting || receipts.length === 0}
            className="batch-export-button"
          >
            JSON・CSV両形式で一括エクスポート
          </button>
        </div>
      </div>

      {exportStatus && (
        <div className={`export-status ${exportStatus.includes('エラー') ? 'error' : 'success'}`}>
          {exportStatus}
        </div>
      )}

      {isExporting && (
        <div className="export-loading">
          <div className="loading-spinner"></div>
          <span>エクスポート中...</span>
        </div>
      )}
    </div>
  )
}