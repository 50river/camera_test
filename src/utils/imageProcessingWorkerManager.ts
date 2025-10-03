// Manager for image processing WebWorker
// Provides a clean interface for offloading heavy image operations

interface WorkerTask {
  id: string
  resolve: (data: any) => void
  reject: (error: Error) => void
  timeout?: NodeJS.Timeout
}

export class ImageProcessingWorkerManager {
  private worker: Worker | null = null
  private pendingTasks = new Map<string, WorkerTask>()
  private taskIdCounter = 0
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Create worker from the TypeScript file
      // In production, this would be compiled to JavaScript
      this.worker = new Worker(
        new URL('../workers/imageProcessingWorker.ts', import.meta.url),
        { type: 'module' }
      )

      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)

      this.isInitialized = true
      console.log('Image processing worker initialized')
    } catch (error) {
      console.error('Failed to initialize image processing worker:', error)
      throw new Error('Failed to initialize image processing worker')
    }
  }

  /**
   * Check if worker is initialized
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const { type, id, data, error } = event.data

    const task = this.pendingTasks.get(id)
    if (!task) {
      console.warn(`Received response for unknown task: ${id}`)
      return
    }

    // Clear timeout
    if (task.timeout) {
      clearTimeout(task.timeout)
    }

    // Remove task from pending
    this.pendingTasks.delete(id)

    if (type === 'success') {
      task.resolve(data)
    } else if (type === 'error') {
      task.reject(new Error(error || 'Worker processing failed'))
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error)
    
    // Reject all pending tasks
    for (const [id, task] of this.pendingTasks) {
      if (task.timeout) {
        clearTimeout(task.timeout)
      }
      task.reject(new Error('Worker crashed'))
    }
    
    this.pendingTasks.clear()
  }

  private generateTaskId(): string {
    return `task_${++this.taskIdCounter}_${Date.now()}`
  }

  private executeTask<T>(type: string, data: any, timeoutMs = 30000): Promise<T> {
    if (!this.worker || !this.isInitialized) {
      throw new Error('Worker not initialized')
    }

    const id = this.generateTaskId()

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(id)
        reject(new Error(`Worker task timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      // Store task
      this.pendingTasks.set(id, { id, resolve, reject, timeout })

      // Send message to worker
      this.worker!.postMessage({ type, id, data })
    })
  }

  async resizeImage(
    imageData: ImageData, 
    maxWidth: number, 
    maxHeight: number
  ): Promise<{ imageData: ImageData, width: number, height: number }> {
    return this.executeTask('resize', { imageData, maxWidth, maxHeight })
  }

  async cropImage(
    imageData: ImageData, 
    region: { x: number, y: number, width: number, height: number }
  ): Promise<{ imageData: ImageData }> {
    return this.executeTask('crop', { imageData, region })
  }

  async applyPerspectiveCorrection(
    imageData: ImageData, 
    corners: { x: number, y: number }[]
  ): Promise<{ imageData: ImageData }> {
    return this.executeTask('perspective', { imageData, corners })
  }

  async preprocessForOCR(
    imageData: ImageData,
    targetWidth: number,
    targetHeight: number,
    normalize = true
  ): Promise<{ 
    tensorData?: Float32Array, 
    imageData: ImageData, 
    width: number, 
    height: number 
  }> {
    return this.executeTask('preprocess', { 
      imageData, 
      targetWidth, 
      targetHeight, 
      normalize 
    })
  }

  terminate(): void {
    if (this.worker) {
      // Reject all pending tasks
      for (const [id, task] of this.pendingTasks) {
        if (task.timeout) {
          clearTimeout(task.timeout)
        }
        task.reject(new Error('Worker terminated'))
      }
      
      this.pendingTasks.clear()
      this.worker.terminate()
      this.worker = null
      this.isInitialized = false
      
      console.log('Image processing worker terminated')
    }
  }

  // Fallback methods for when WebWorker is not available
  async resizeImageFallback(
    imageData: ImageData, 
    maxWidth: number, 
    maxHeight: number
  ): Promise<{ imageData: ImageData, width: number, height: number }> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
    
    // Calculate new dimensions
    const ratio = Math.min(maxWidth / imageData.width, maxHeight / imageData.height)
    const newWidth = Math.floor(imageData.width * ratio)
    const newHeight = Math.floor(imageData.height * ratio)
    
    const resizedCanvas = document.createElement('canvas')
    const resizedCtx = resizedCanvas.getContext('2d')!
    resizedCanvas.width = newWidth
    resizedCanvas.height = newHeight
    
    resizedCtx.imageSmoothingEnabled = true
    resizedCtx.imageSmoothingQuality = 'high'
    resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight)
    
    const resizedImageData = resizedCtx.getImageData(0, 0, newWidth, newHeight)
    
    return { imageData: resizedImageData, width: newWidth, height: newHeight }
  }

  async cropImageFallback(
    imageData: ImageData, 
    region: { x: number, y: number, width: number, height: number }
  ): Promise<{ imageData: ImageData }> {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
    
    const croppedCanvas = document.createElement('canvas')
    const croppedCtx = croppedCanvas.getContext('2d')!
    croppedCanvas.width = region.width
    croppedCanvas.height = region.height
    
    croppedCtx.drawImage(
      canvas,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    )
    
    const croppedImageData = croppedCtx.getImageData(0, 0, region.width, region.height)
    
    return { imageData: croppedImageData }
  }

  // Check if WebWorker is supported
  static isWebWorkerSupported(): boolean {
    return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
  }
}

// Singleton instance
let workerManager: ImageProcessingWorkerManager | null = null

export function getImageProcessingWorkerManager(): ImageProcessingWorkerManager {
  if (!workerManager) {
    workerManager = new ImageProcessingWorkerManager()
  }
  return workerManager
}

export function terminateImageProcessingWorker(): void {
  if (workerManager) {
    workerManager.terminate()
    workerManager = null
  }
}