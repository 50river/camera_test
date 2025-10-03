// Model manager for lazy loading and caching ONNX models
// Optimizes memory usage and loading performance

import { InferenceSession } from 'onnxruntime-web'

interface ModelInfo {
  name: string
  path: string
  session: InferenceSession | null
  loading: Promise<InferenceSession> | null
  lastUsed: number
  size?: number
}

export class ModelManager {
  private models = new Map<string, ModelInfo>()
  private maxCacheSize = 200 * 1024 * 1024 // 200MB cache limit
  private currentCacheSize = 0
  private sessionOptions: any
  private initialized = false

  constructor() {
    this.sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: false,
      enableMemPattern: false,
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Configure ONNX runtime
      const ort = await import('onnxruntime-web')
      ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/'
      ort.env.wasm.numThreads = navigator.hardwareConcurrency || 1
      
      // Register models without loading them
      this.registerModel('detection', '/models/det_model.onnx')
      this.registerModel('recognition', '/models/rec_model.onnx')
      
      this.initialized = true
      console.log('Model manager initialized')
    } catch (error) {
      console.error('Failed to initialize model manager:', error)
      throw new Error('Failed to initialize model manager')
    }
  }

  private registerModel(name: string, path: string): void {
    this.models.set(name, {
      name,
      path,
      session: null,
      loading: null,
      lastUsed: 0
    })
  }

  async getModel(name: string): Promise<InferenceSession> {
    const modelInfo = this.models.get(name)
    if (!modelInfo) {
      throw new Error(`Model '${name}' not registered`)
    }

    // Return cached session if available
    if (modelInfo.session) {
      modelInfo.lastUsed = Date.now()
      return modelInfo.session
    }

    // Return loading promise if already loading
    if (modelInfo.loading) {
      return modelInfo.loading
    }

    // Start loading the model
    console.log(`Loading model: ${name}`)
    modelInfo.loading = this.loadModel(modelInfo)

    try {
      const session = await modelInfo.loading
      modelInfo.session = session
      modelInfo.lastUsed = Date.now()
      modelInfo.loading = null

      // Estimate model size (rough approximation)
      modelInfo.size = await this.estimateModelSize(modelInfo.path)
      this.currentCacheSize += modelInfo.size

      console.log(`Model '${name}' loaded successfully (${this.formatBytes(modelInfo.size)})`)

      // Check if we need to free up memory
      await this.enforceMemoryLimit()

      return session
    } catch (error) {
      modelInfo.loading = null
      console.error(`Failed to load model '${name}':`, error)
      throw error
    }
  }

  private async loadModel(modelInfo: ModelInfo): Promise<InferenceSession> {
    try {
      // Use fetch with progress tracking for better UX
      const response = await fetch(modelInfo.path)
      if (!response.ok) {
        throw new Error(`Failed to fetch model: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const session = await InferenceSession.create(arrayBuffer, this.sessionOptions)
      
      return session
    } catch (error) {
      throw new Error(`Failed to load model from ${modelInfo.path}: ${error}`)
    }
  }

  private async estimateModelSize(path: string): Promise<number> {
    try {
      const response = await fetch(path, { method: 'HEAD' })
      const contentLength = response.headers.get('content-length')
      return contentLength ? parseInt(contentLength, 10) : 50 * 1024 * 1024 // Default 50MB
    } catch {
      return 50 * 1024 * 1024 // Default 50MB if can't determine
    }
  }

  private async enforceMemoryLimit(): Promise<void> {
    if (this.currentCacheSize <= this.maxCacheSize) {
      return
    }

    console.log(`Memory limit exceeded (${this.formatBytes(this.currentCacheSize)}/${this.formatBytes(this.maxCacheSize)}), freeing up space...`)

    // Sort models by last used time (oldest first)
    const sortedModels = Array.from(this.models.values())
      .filter(model => model.session !== null)
      .sort((a, b) => a.lastUsed - b.lastUsed)

    // Free up models until we're under the limit
    for (const modelInfo of sortedModels) {
      if (this.currentCacheSize <= this.maxCacheSize * 0.8) { // Leave some headroom
        break
      }

      await this.unloadModel(modelInfo.name)
    }
  }

  async unloadModel(name: string): Promise<void> {
    const modelInfo = this.models.get(name)
    if (!modelInfo || !modelInfo.session) {
      return
    }

    try {
      // Release the session
      await modelInfo.session.release()
      
      // Update cache size
      if (modelInfo.size) {
        this.currentCacheSize -= modelInfo.size
      }

      // Reset model info
      modelInfo.session = null
      modelInfo.lastUsed = 0

      console.log(`Model '${name}' unloaded, freed ${this.formatBytes(modelInfo.size || 0)}`)
    } catch (error) {
      console.error(`Error unloading model '${name}':`, error)
    }
  }

  async preloadModels(modelNames: string[]): Promise<void> {
    console.log('Preloading models:', modelNames)
    
    const loadPromises = modelNames.map(async (name) => {
      try {
        await this.getModel(name)
      } catch (error) {
        console.error(`Failed to preload model '${name}':`, error)
      }
    })

    await Promise.all(loadPromises)
  }

  getModelInfo(): { name: string, loaded: boolean, size?: number, lastUsed: number }[] {
    return Array.from(this.models.values()).map(model => ({
      name: model.name,
      loaded: model.session !== null,
      size: model.size,
      lastUsed: model.lastUsed
    }))
  }

  getCacheInfo(): { totalSize: number, maxSize: number, modelCount: number } {
    const loadedModels = Array.from(this.models.values()).filter(m => m.session !== null)
    
    return {
      totalSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      modelCount: loadedModels.length
    }
  }

  async clearCache(): Promise<void> {
    console.log('Clearing model cache...')
    
    const unloadPromises = Array.from(this.models.keys()).map(name => 
      this.unloadModel(name)
    )
    
    await Promise.all(unloadPromises)
    this.currentCacheSize = 0
    
    console.log('Model cache cleared')
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Memory pressure handling
  handleMemoryPressure(): void {
    console.log('Memory pressure detected, clearing least recently used models')
    
    // Immediately free up 50% of cache
    const targetSize = this.maxCacheSize * 0.5
    
    const sortedModels = Array.from(this.models.values())
      .filter(model => model.session !== null)
      .sort((a, b) => a.lastUsed - b.lastUsed)

    let freedSize = 0
    for (const modelInfo of sortedModels) {
      if (this.currentCacheSize - freedSize <= targetSize) {
        break
      }

      this.unloadModel(modelInfo.name)
      freedSize += modelInfo.size || 0
    }
  }

  destroy(): void {
    console.log('Destroying model manager...')
    this.clearCache()
    this.models.clear()
    this.initialized = false
  }
}

// Singleton instance
let modelManager: ModelManager | null = null

export function getModelManager(): ModelManager {
  if (!modelManager) {
    modelManager = new ModelManager()
  }
  return modelManager
}

export function destroyModelManager(): void {
  if (modelManager) {
    modelManager.destroy()
    modelManager = null
  }
}

// Memory pressure detection
if (typeof window !== 'undefined' && 'memory' in performance) {
  // Monitor memory usage periodically
  setInterval(() => {
    const memInfo = (performance as any).memory
    if (memInfo) {
      const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit
      
      // If using more than 80% of available memory, trigger cleanup
      if (usedRatio > 0.8 && modelManager) {
        modelManager.handleMemoryPressure()
      }
    }
  }, 10000) // Check every 10 seconds
}