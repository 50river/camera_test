import { PaddleOCREngine } from '../engines/OCREngine'
import { ReceiptDataExtractor } from '../engines/DataExtractionEngine'
import { ReceiptNormalizationEngine } from '../engines/NormalizationEngine'
import { ReceiptStorage } from './storage'
import { configManager } from './configManager'
import { appLifecycle } from './appLifecycle'
import { memoryManager } from './memoryManager'
import { getModelManager } from './modelManager'
import { getImageProcessingWorkerManager } from './imageProcessingWorkerManager'
import { errorHandler } from './errorHandler'
import { errorRecovery } from './errorRecovery'

/**
 * Service Registry
 * Central registry for all application services with dependency injection
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry
  private services: Map<string, any> = new Map()
  private initialized = false

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry()
    }
    return ServiceRegistry.instance
  }

  /**
   * Initialize all services
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      console.log('Initializing service registry...')

      // Initialize application lifecycle first
      await appLifecycle.initialize()
      const lifecycleServices = appLifecycle.getServices()

      // Register core services
      this.register('configManager', configManager)
      this.register('appLifecycle', appLifecycle)
      this.register('memoryManager', memoryManager)
      this.register('modelManager', lifecycleServices.modelManager)
      this.register('workerManager', lifecycleServices.workerManager)
      this.register('errorHandler', errorHandler)
      this.register('errorRecovery', errorRecovery)

      // Register engines
      this.register('ocrEngine', lifecycleServices.ocrEngine)
      this.register('dataExtractor', new ReceiptDataExtractor())
      this.register('normalizationEngine', new ReceiptNormalizationEngine())
      this.register('storage', lifecycleServices.storage)

      this.initialized = true
      console.log('Service registry initialized')

    } catch (error) {
      console.error('Service registry initialization failed:', error)
      throw error
    }
  }

  /**
   * Register a service
   */
  public register<T>(name: string, service: T): void {
    this.services.set(name, service)
  }

  /**
   * Get a service by name
   */
  public get<T>(name: string): T {
    if (!this.initialized) {
      throw new Error('Service registry not initialized. Call initialize() first.')
    }

    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not found in registry`)
    }
    return service as T
  }

  /**
   * Check if a service is registered
   */
  public has(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * Get all registered service names
   */
  public getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Get OCR Engine
   */
  public getOCREngine(): PaddleOCREngine {
    return this.get<PaddleOCREngine>('ocrEngine')
  }

  /**
   * Get Data Extractor
   */
  public getDataExtractor(): ReceiptDataExtractor {
    return this.get<ReceiptDataExtractor>('dataExtractor')
  }

  /**
   * Get Normalization Engine
   */
  public getNormalizationEngine(): ReceiptNormalizationEngine {
    return this.get<ReceiptNormalizationEngine>('normalizationEngine')
  }

  /**
   * Get Storage
   */
  public getStorage(): ReceiptStorage {
    return this.get<ReceiptStorage>('storage')
  }

  /**
   * Get Config Manager
   */
  public getConfigManager() {
    return this.get('configManager')
  }

  /**
   * Get Memory Manager
   */
  public getMemoryManager() {
    return this.get('memoryManager')
  }

  /**
   * Get Model Manager
   */
  public getModelManager() {
    return this.get('modelManager')
  }

  /**
   * Get Worker Manager
   */
  public getWorkerManager() {
    return this.get('workerManager')
  }

  /**
   * Get Error Handler
   */
  public getErrorHandler() {
    return this.get('errorHandler')
  }

  /**
   * Get Error Recovery
   */
  public getErrorRecovery() {
    return this.get('errorRecovery')
  }

  /**
   * Destroy all services
   */
  public async destroy(): Promise<void> {
    if (!this.initialized) {
      return
    }

    console.log('Destroying service registry...')

    // Destroy application lifecycle (which handles cleanup of core services)
    await appLifecycle.destroy()

    // Clear service registry
    this.services.clear()
    this.initialized = false

    console.log('Service registry destroyed')
  }

  /**
   * Get service status
   */
  public getStatus() {
    return {
      initialized: this.initialized,
      serviceCount: this.services.size,
      services: this.getServiceNames(),
      appStatus: this.initialized ? appLifecycle.getStatus() : null
    }
  }

  /**
   * Restart all services
   */
  public async restart(): Promise<void> {
    await this.destroy()
    await this.initialize()
  }

  /**
   * Create a service factory function
   */
  public createFactory<T>(serviceName: string): () => T {
    return () => this.get<T>(serviceName)
  }

  /**
   * Create multiple service factories
   */
  public createFactories<T extends Record<string, string>>(
    serviceMap: T
  ): { [K in keyof T]: () => any } {
    const factories = {} as { [K in keyof T]: () => any }
    
    for (const [key, serviceName] of Object.entries(serviceMap)) {
      factories[key as keyof T] = this.createFactory(serviceName)
    }
    
    return factories
  }

  /**
   * Inject services into a class constructor
   */
  public inject<T>(
    constructor: new (...services: any[]) => T,
    serviceNames: string[]
  ): T {
    const services = serviceNames.map(name => this.get(name))
    return new constructor(...services)
  }

  /**
   * Get performance metrics from all services
   */
  public getPerformanceMetrics() {
    if (!this.initialized) {
      return null
    }

    return {
      registry: this.getStatus(),
      lifecycle: appLifecycle.getPerformanceMetrics(),
      memory: memoryManager.getMemoryInfo(),
      models: getModelManager().getCacheInfo(),
      worker: {
        initialized: getImageProcessingWorkerManager().getInitializationStatus()
      }
    }
  }
}

// Export singleton instance
export const serviceRegistry = ServiceRegistry.getInstance()

// Export convenience hooks for React components
export function useService<T>(serviceName: string): T {
  return serviceRegistry.get<T>(serviceName)
}

export function useServices<T extends Record<string, string>>(
  serviceMap: T
): { [K in keyof T]: any } {
  const services = {} as { [K in keyof T]: any }
  
  for (const [key, serviceName] of Object.entries(serviceMap)) {
    services[key as keyof T] = serviceRegistry.get(serviceName)
  }
  
  return services
}