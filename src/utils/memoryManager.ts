// Memory management utilities for performance optimization
// Helps prevent memory leaks and optimize garbage collection

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

export class MemoryManager {
  private static instance: MemoryManager | null = null
  private memoryPressureCallbacks: Array<() => void> = []
  private monitoringInterval: NodeJS.Timeout | null = null
  private isMonitoring = false
  
  // Memory thresholds
  private readonly WARNING_THRESHOLD = 0.7  // 70% of heap limit
  private readonly CRITICAL_THRESHOLD = 0.85 // 85% of heap limit
  private readonly MONITOR_INTERVAL = 5000   // 5 seconds

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  startMonitoring(): void {
    if (this.isMonitoring || !this.isMemoryAPIAvailable()) {
      return
    }

    console.log('Starting memory monitoring...')
    this.isMonitoring = true

    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, this.MONITOR_INTERVAL)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
    this.isMonitoring = false
    console.log('Memory monitoring stopped')
  }

  private checkMemoryUsage(): void {
    const memInfo = this.getMemoryInfo()
    if (!memInfo) return

    const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit

    if (usageRatio > this.CRITICAL_THRESHOLD) {
      console.warn(`Critical memory usage: ${(usageRatio * 100).toFixed(1)}%`)
      this.triggerMemoryPressureCallbacks()
      this.forceGarbageCollection()
    } else if (usageRatio > this.WARNING_THRESHOLD) {
      console.warn(`High memory usage: ${(usageRatio * 100).toFixed(1)}%`)
      this.triggerMemoryPressureCallbacks()
    }
  }

  private triggerMemoryPressureCallbacks(): void {
    this.memoryPressureCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Memory pressure callback failed:', error)
      }
    })
  }

  addMemoryPressureCallback(callback: () => void): void {
    this.memoryPressureCallbacks.push(callback)
  }

  removeMemoryPressureCallback(callback: () => void): void {
    const index = this.memoryPressureCallbacks.indexOf(callback)
    if (index > -1) {
      this.memoryPressureCallbacks.splice(index, 1)
    }
  }

  getMemoryInfo(): MemoryInfo | null {
    if (!this.isMemoryAPIAvailable()) {
      return null
    }

    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    }
  }

  getMemoryUsagePercentage(): number | null {
    const memInfo = this.getMemoryInfo()
    if (!memInfo) return null

    return (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100
  }

  formatMemorySize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  private forceGarbageCollection(): void {
    // Force garbage collection if available (Chrome DevTools)
    if (typeof window !== 'undefined' && (window as any).gc) {
      try {
        (window as any).gc()
        console.log('Forced garbage collection')
      } catch (error) {
        console.warn('Failed to force garbage collection:', error)
      }
    }
  }

  private isMemoryAPIAvailable(): boolean {
    return typeof window !== 'undefined' && 
           typeof performance !== 'undefined' && 
           'memory' in performance
  }

  // Canvas cleanup utilities
  cleanupCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    canvas.width = 0
    canvas.height = 0
  }

  cleanupImageData(imageData: ImageData): void {
    // Clear the data array (though this might not immediately free memory)
    if (imageData.data) {
      imageData.data.fill(0)
    }
  }

  // Batch processing utilities to prevent memory spikes
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize = 5,
    delayMs = 10
  ): Promise<R[]> {
    const results: R[] = []

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      )
      
      results.push(...batchResults)

      // Small delay between batches to allow garbage collection
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }

      // Check memory pressure after each batch
      const memUsage = this.getMemoryUsagePercentage()
      if (memUsage && memUsage > this.WARNING_THRESHOLD * 100) {
        console.warn(`High memory usage during batch processing: ${memUsage.toFixed(1)}%`)
        // Increase delay for next batch
        await new Promise(resolve => setTimeout(resolve, delayMs * 2))
      }
    }

    return results
  }

  // Object pool for reusing expensive objects
  createObjectPool<T>(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize = 10
  ): {
    acquire: () => T
    release: (obj: T) => void
    clear: () => void
  } {
    const pool: T[] = []

    return {
      acquire: (): T => {
        if (pool.length > 0) {
          return pool.pop()!
        }
        return factory()
      },

      release: (obj: T): void => {
        if (pool.length < maxSize) {
          reset(obj)
          pool.push(obj)
        }
      },

      clear: (): void => {
        pool.length = 0
      }
    }
  }

  // Debounced function to prevent excessive calls
  debounce<T extends (...args: any[]) => any>(
    func: T,
    waitMs: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null

    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(() => {
        func(...args)
      }, waitMs)
    }
  }

  destroy(): void {
    this.stopMonitoring()
    this.memoryPressureCallbacks.length = 0
    MemoryManager.instance = null
  }
}

// Singleton access
export const memoryManager = MemoryManager.getInstance()

// Utility functions
export function withMemoryCleanup<T>(
  operation: () => Promise<T>,
  cleanup: () => void
): Promise<T> {
  return operation().finally(cleanup)
}

export function createCanvasPool(maxSize = 5) {
  return memoryManager.createObjectPool(
    () => document.createElement('canvas'),
    (canvas) => {
      memoryManager.cleanupCanvas(canvas)
    },
    maxSize
  )
}

// Auto-start monitoring in browser environment
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay
  setTimeout(() => {
    memoryManager.startMonitoring()
  }, 1000)

  // Stop monitoring when page unloads
  window.addEventListener('beforeunload', () => {
    memoryManager.destroy()
  })
}