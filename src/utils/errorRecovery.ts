import { AppError, ErrorRecoveryAction } from '../types/errors'
import { errorHandler } from './errorHandler'

export class ErrorRecovery {
  private static instance: ErrorRecovery
  private retryAttempts: Map<string, number> = new Map()
  private maxRetries = 3

  static getInstance(): ErrorRecovery {
    if (!ErrorRecovery.instance) {
      ErrorRecovery.instance = new ErrorRecovery()
    }
    return ErrorRecovery.instance
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    operationId: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    const attempts = this.retryAttempts.get(operationId) || 0

    try {
      const result = await operation()
      // Reset retry count on success
      this.retryAttempts.delete(operationId)
      return result
    } catch (error) {
      if (attempts < maxRetries) {
        this.retryAttempts.set(operationId, attempts + 1)
        
        // Exponential backoff
        const delay = Math.pow(2, attempts) * 1000
        await this.delay(delay)
        
        return this.retryOperation(operation, operationId, maxRetries)
      } else {
        // Max retries exceeded
        this.retryAttempts.delete(operationId)
        throw error
      }
    }
  }

  async retryOCR(
    imageData: ImageData,
    ocrEngine: any,
    maxRetries: number = 2
  ): Promise<any[]> {
    return this.retryOperation(
      () => ocrEngine.processFullImage(imageData),
      `ocr_${this.getImageHash(imageData)}`,
      maxRetries
    )
  }

  async retryModelLoad(
    modelLoader: () => Promise<void>,
    modelName: string
  ): Promise<void> {
    return this.retryOperation(
      modelLoader,
      `model_load_${modelName}`,
      2
    )
  }

  fallbackToManualInput(fieldName: string, onManualInput: () => void): void {
    console.log(`Falling back to manual input for field: ${fieldName}`)
    onManualInput()
  }

  suggestImageImprovement(error: AppError): string[] {
    const suggestions: string[] = []

    switch (error.code) {
      case 'OCR_DETECTION_FAILED':
        suggestions.push(
          '画像の明度を上げてください',
          '文字がはっきり見えるように撮影してください',
          '影や反射を避けてください'
        )
        break
      case 'OCR_RECOGNITION_FAILED':
        suggestions.push(
          'より高解像度で撮影してください',
          '文字に焦点を合わせてください',
          '手ブレを避けてください'
        )
        break
      case 'IMAGE_TOO_SMALL':
        suggestions.push(
          'より近くから撮影してください',
          '高解像度モードを使用してください'
        )
        break
      case 'IMAGE_TOO_LARGE':
        suggestions.push(
          '画像を圧縮してください',
          '低解像度で撮影してください'
        )
        break
      case 'PERSPECTIVE_CORRECTION_FAILED':
        suggestions.push(
          '領収書全体が写るように撮影してください',
          '正面から撮影してください',
          '四隅がはっきり見えるように撮影してください'
        )
        break
    }

    return suggestions
  }

  async handleCriticalError(error: AppError): Promise<void> {
    console.error('Critical error occurred:', error)
    
    // Save error to local storage for debugging
    try {
      const errorLog = {
        error,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
      
      localStorage.setItem('lastCriticalError', JSON.stringify(errorLog))
    } catch (e) {
      console.error('Failed to save error log:', e)
    }

    // Show critical error message
    if (error.type === 'system') {
      this.showCriticalErrorDialog(error)
    }
  }

  private showCriticalErrorDialog(error: AppError): void {
    const message = errorHandler.getLocalizedMessage(error)
    const shouldReload = confirm(
      `重大なエラーが発生しました:\n${message}\n\nページを再読み込みしますか？`
    )
    
    if (shouldReload) {
      window.location.reload()
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getImageHash(imageData: ImageData): string {
    // Simple hash based on image dimensions and some pixel data
    const { width, height, data } = imageData
    let hash = width * height
    
    // Sample some pixels for hash
    for (let i = 0; i < Math.min(data.length, 1000); i += 100) {
      hash = (hash * 31 + data[i]) % 1000000
    }
    
    return hash.toString()
  }

  getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0
  }

  resetRetryCount(operationId: string): void {
    this.retryAttempts.delete(operationId)
  }

  clearAllRetries(): void {
    this.retryAttempts.clear()
  }
}

export const errorRecovery = ErrorRecovery.getInstance()