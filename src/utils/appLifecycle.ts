import { configManager } from './configManager'
import { memoryManager } from './memoryManager'
import { getModelManager } from './modelManager'
import { getImageProcessingWorkerManager } from './imageProcessingWorkerManager'
import { PaddleOCREngine } from '../engines/OCREngine'
import { ReceiptStorage } from './storage'
import { errorHandler } from './errorHandler'

/**
 * Application Lifecycle Manager
 * Handles application initialization, cleanup, and state management
 */
export class AppLifecycleManager {
  private static instance: AppLifecycleManager
  private isInitialized = false
  private isDestroying = false
  private initializationPromise: Promise<void> | null = null
  private cleanupCallbacks: Array<() => void | Promise<void>> = []

  // Core services
  private ocrEngine: PaddleOCREngine | null = null
  private storage: ReceiptStorage | null = null
  private modelManager = getModelManager()
  private workerManager = getImageProcessingWorkerManager()

  private constructor() {}

  public static getInstance(): AppLifecycleManager {
    if (!AppLifecycleManager.instance) {
      AppLifecycleManager.instance = new AppLifecycleManager()
    }
    return AppLifecycleManager.instance
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._performInitialization()
    return this.initializationPromise
  }

  private async _performInitialization(): Promise<void> {
    try {
      console.log('Starting application initialization...')

      // 1. Initialize configuration
      const config = configManager.getConfig()
      console.log('Configuration loaded:', config)

      // 2. Initialize storage
      this.storage = new ReceiptStorage()
      await this.storage.initialize()
      console.log('Storage initialized')

      // 3. Initialize memory management
      memoryManager.startMonitoring()
      console.log('Memory monitoring started')

      // 4. Initialize OCR engine
      this.ocrEngine = new PaddleOCREngine()
      console.log('OCR engine created')

      // 5. Initialize WebWorker (optional)
      try {
        await this.workerManager.initialize()
        console.log('WebWorker initialized')
      } catch (error) {
        console.warn('WebWorker initialization failed, continuing without:', error)
      }

      // 6. Set up memory pressure handling
      const memoryPressureCallback = () => {
        console.log('Memory pressure detected, clearing caches')
        this.modelManager.clearCache()
        if (this.ocrEngine) {
          this.ocrEngine.clearCache()
        }
      }
      memoryManager.addMemoryPressureCallback(memoryPressureCallback)

      // 7. Set up cleanup callbacks
      this.addCleanupCallback(() => {
        memoryManager.destroy()
      })

      this.addCleanupCallback(() => {
        this.workerManager.terminate()
      })

      this.addCleanupCallback(() => {
        if (this.ocrEngine) {
          this.ocrEngine.destroy()
        }
      })

      // 8. Set up error handling
      this.setupGlobalErrorHandling()

      // 9. Set up beforeunload handler
      this.setupBeforeUnloadHandler()

      this.isInitialized = true
      console.log('Application initialization completed')

    } catch (error) {
      console.error('Application initialization failed:', error)
      throw error
    }
  }

  /**
   * Get initialized services
   */
  public getServices() {
    if (!this.isInitialized) {
      throw new Error('Application not initialized. Call initialize() first.')
    }

    return {
      ocrEngine: this.ocrEngine!,
      storage: this.storage!,
      modelManager: this.modelManager,
      workerManager: this.workerManager,
      configManager
    }
  }

  /**
   * Add cleanup callback
   */
  public addCleanupCallback(callback: () => void | Promise<void>): void {
    this.cleanupCallbacks.push(callback)
  }

  /**
   * Remove cleanup callback
   */
  public removeCleanupCallback(callback: () => void | Promise<void>): void {
    const index = this.cleanupCallbacks.indexOf(callback)
    if (index > -1) {
      this.cleanupCallbacks.splice(index, 1)
    }
  }

  /**
   * Destroy the application and cleanup resources
   */
  public async destroy(): Promise<void> {
    if (this.isDestroying) {
      return
    }

    this.isDestroying = true
    console.log('Starting application cleanup...')

    // Run cleanup callbacks in reverse order
    for (let i = this.cleanupCallbacks.length - 1; i >= 0; i--) {
      try {
        const callback = this.cleanupCallbacks[i]
        const result = callback()
        if (result instanceof Promise) {
          await result
        }
      } catch (error) {
        console.error('Error during cleanup:', error)
      }
    }

    this.cleanupCallbacks = []
    this.isInitialized = false
    this.isDestroying = false
    this.initializationPromise = null

    console.log('Application cleanup completed')
  }

  /**
   * Check if application is initialized
   */
  public get initialized(): boolean {
    return this.isInitialized
  }

  /**
   * Get application status
   */
  public getStatus() {
    return {
      initialized: this.isInitialized,
      destroying: this.isDestroying,
      memoryUsage: memoryManager.getMemoryInfo(),
      modelCache: this.modelManager.getCacheInfo(),
      workerStatus: this.workerManager.getInitializationStatus()
    }
  }

  /**
   * Setup global error handling
   */
  private setupGlobalErrorHandling(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      errorHandler.handleError(event.reason, {
        component: 'Global',
        operation: 'unhandled_rejection'
      })
      event.preventDefault()
    })

    // Handle global errors
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error)
      errorHandler.handleError(event.error, {
        component: 'Global',
        operation: 'global_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })
  }

  /**
   * Setup beforeunload handler for cleanup
   */
  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      // Synchronous cleanup only
      try {
        if (this.ocrEngine) {
          this.ocrEngine.clearCache()
        }
        this.modelManager.clearCache()
        memoryManager.destroy()
      } catch (error) {
        console.error('Error during beforeunload cleanup:', error)
      }
    })
  }

  /**
   * Restart the application
   */
  public async restart(): Promise<void> {
    await this.destroy()
    await this.initialize()
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return {
      memoryUsage: memoryManager.getMemoryInfo(),
      modelCache: this.modelManager.getCacheInfo(),
      ocrPerformance: this.ocrEngine?.getPerformanceInfo() || null,
      workerStatus: this.workerManager.getInitializationStatus()
    }
  }

  /**
   * Preload critical resources
   */
  public async preloadResources(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Application not initialized')
    }

    try {
      console.log('Preloading critical resources...')
      
      // Preload OCR models
      if (this.ocrEngine) {
        await this.ocrEngine.preloadModels()
      }
      
      console.log('Resource preloading completed')
    } catch (error) {
      console.warn('Resource preloading failed:', error)
    }
  }
}

// Export singleton instance
export const appLifecycle = AppLifecycleManager.getInstance()