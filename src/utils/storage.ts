import { Receipt, ProcessingStep } from '../types'

export class ReceiptStorage {
  private dbName = 'ReceiptOCRDB'
  private version = 2
  private db: IDBDatabase | null = null

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create receipts store
        if (!db.objectStoreNames.contains('receipts')) {
          const receiptStore = db.createObjectStore('receipts', { keyPath: 'id' })
          receiptStore.createIndex('createdAt', 'createdAt', { unique: false })
          receiptStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        // Create processing history store
        if (!db.objectStoreNames.contains('processingHistory')) {
          const historyStore = db.createObjectStore('processingHistory', { keyPath: 'id', autoIncrement: true })
          historyStore.createIndex('receiptId', 'receiptId', { unique: false })
          historyStore.createIndex('timestamp', 'timestamp', { unique: false })
          historyStore.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  async saveReceipt(receipt: Receipt): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    // Update the updatedAt timestamp
    receipt.updatedAt = new Date()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts', 'processingHistory'], 'readwrite')
      const receiptStore = transaction.objectStore('receipts')
      const historyStore = transaction.objectStore('processingHistory')

      // Save receipt
      const receiptRequest = receiptStore.put(receipt)
      
      // Save processing history entries
      receipt.processingHistory.forEach(step => {
        const historyEntry = {
          receiptId: receipt.id,
          ...step
        }
        historyStore.add(historyEntry)
      })

      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
    })
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts'], 'readonly')
      const store = transaction.objectStore('receipts')
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result || null)
    })
  }

  async getReceipts(limit?: number, offset?: number): Promise<Receipt[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts'], 'readonly')
      const store = transaction.objectStore('receipts')
      const index = store.index('createdAt')
      
      let request: IDBRequest
      if (limit !== undefined) {
        const range = IDBKeyRange.lowerBound(new Date(0))
        request = index.openCursor(range, 'prev')
        
        const results: Receipt[] = []
        let count = 0
        let skipped = 0
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result
          if (cursor && count < limit) {
            if (offset && skipped < offset) {
              skipped++
              cursor.continue()
              return
            }
            results.push(cursor.value)
            count++
            cursor.continue()
          } else {
            resolve(results)
          }
        }
      } else {
        request = store.getAll()
        request.onsuccess = () => {
          const results = request.result.sort((a: Receipt, b: Receipt) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    const existingReceipt = await this.getReceipt(id)
    if (!existingReceipt) {
      throw new Error(`Receipt with id ${id} not found`)
    }

    const updatedReceipt: Receipt = {
      ...existingReceipt,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date()
    }

    await this.saveReceipt(updatedReceipt)
  }

  async deleteReceipt(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts', 'processingHistory'], 'readwrite')
      const receiptStore = transaction.objectStore('receipts')
      const historyStore = transaction.objectStore('processingHistory')

      // Delete receipt
      receiptStore.delete(id)

      // Delete associated processing history
      const historyIndex = historyStore.index('receiptId')
      const historyRequest = historyIndex.openCursor(IDBKeyRange.only(id))
      
      historyRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        }
      }

      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
    })
  }

  // Processing History Management
  async addProcessingStep(receiptId: string, step: ProcessingStep): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingHistory'], 'readwrite')
      const store = transaction.objectStore('processingHistory')
      
      const historyEntry = {
        receiptId,
        ...step
      }
      
      const request = store.add(historyEntry)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getProcessingHistory(receiptId: string): Promise<ProcessingStep[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingHistory'], 'readonly')
      const store = transaction.objectStore('processingHistory')
      const index = store.index('receiptId')
      const request = index.getAll(receiptId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result.map(entry => ({
          type: entry.type,
          timestamp: entry.timestamp,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          confidence: entry.confidence
        }))
        
        // Sort by timestamp
        results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        resolve(results)
      }
    })
  }

  async getAllProcessingHistory(): Promise<Array<ProcessingStep & { receiptId: string }>> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingHistory'], 'readonly')
      const store = transaction.objectStore('processingHistory')
      const request = store.getAll()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result.map(entry => ({
          receiptId: entry.receiptId,
          type: entry.type,
          timestamp: entry.timestamp,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
          confidence: entry.confidence
        }))
        
        // Sort by timestamp
        results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        resolve(results)
      }
    })
  }

  // Statistics and Analytics
  async getReceiptCount(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts'], 'readonly')
      const store = transaction.objectStore('receipts')
      const request = store.count()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  async getReceiptsByDateRange(startDate: Date, endDate: Date): Promise<Receipt[]> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts'], 'readonly')
      const store = transaction.objectStore('receipts')
      const index = store.index('createdAt')
      const range = IDBKeyRange.bound(startDate, endDate)
      const request = index.getAll(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  // Export functionality
  async exportToJSON(receipts: Receipt[]): Promise<Blob> {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      receipts: receipts.map(receipt => ({
        ...receipt,
        imageData: null // Exclude image data from JSON export for size
      }))
    }
    
    const data = JSON.stringify(exportData, null, 2)
    return new Blob([data], { type: 'application/json' })
  }

  async exportToCSV(receipts: Receipt[]): Promise<Blob> {
    const headers = ['ID', '日付', '支払先', '金額', '適用', '信頼度', '作成日時', '更新日時']
    const rows = receipts.map(r => [
      r.id,
      r.extractedData.date.value,
      r.extractedData.payee.value,
      r.extractedData.amount.value,
      r.extractedData.usage.value,
      Math.min(
        r.extractedData.date.confidence,
        r.extractedData.payee.confidence,
        r.extractedData.amount.confidence,
        r.extractedData.usage.confidence
      ).toFixed(2),
      new Date(r.createdAt).toLocaleString('ja-JP'),
      new Date(r.updatedAt).toLocaleString('ja-JP')
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    
    // Add BOM for proper UTF-8 encoding in Excel
    const bom = '\uFEFF'
    return new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' })
  }

  // Batch operations
  async exportAllToJSON(): Promise<Blob> {
    const receipts = await this.getReceipts()
    return this.exportToJSON(receipts)
  }

  async exportAllToCSV(): Promise<Blob> {
    const receipts = await this.getReceipts()
    return this.exportToCSV(receipts)
  }

  // Database maintenance
  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['receipts', 'processingHistory'], 'readwrite')
      
      transaction.objectStore('receipts').clear()
      transaction.objectStore('processingHistory').clear()

      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve()
    })
  }

  // Alias for clearAllData
  async clearAll(): Promise<void> {
    return this.clearAllData()
  }

  async getDatabaseSize(): Promise<{ receipts: number; history: number }> {
    if (!this.db) throw new Error('Database not initialized')

    const receiptCount = await this.getReceiptCount()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['processingHistory'], 'readonly')
      const store = transaction.objectStore('processingHistory')
      const request = store.count()

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve({
        receipts: receiptCount,
        history: request.result
      })
    })
  }
}