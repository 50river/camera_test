import { AppError, SystemError, InputError, ProcessingError, UserError, ErrorRecoveryAction, ErrorContext } from '../types/errors'

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorListeners: ((error: AppError, context?: ErrorContext) => void)[] = []

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  // Error creation methods
  createSystemError(code: SystemError['code'], message: string, details?: string): SystemError {
    return {
      type: 'system',
      code,
      message,
      details,
      timestamp: new Date(),
      recoverable: this.isRecoverable('system', code)
    }
  }

  createInputError(code: InputError['code'], message: string, details?: string): InputError {
    return {
      type: 'input',
      code,
      message,
      details,
      timestamp: new Date(),
      recoverable: this.isRecoverable('input', code)
    }
  }

  createProcessingError(code: ProcessingError['code'], message: string, details?: string): ProcessingError {
    return {
      type: 'processing',
      code,
      message,
      details,
      timestamp: new Date(),
      recoverable: this.isRecoverable('processing', code)
    }
  }

  createUserError(code: UserError['code'], message: string, details?: string): UserError {
    return {
      type: 'user',
      code,
      message,
      details,
      timestamp: new Date(),
      recoverable: this.isRecoverable('user', code)
    }
  }

  // Error handling methods
  handleError(error: AppError | Error, context?: ErrorContext): AppError {
    let appError: AppError

    if (this.isAppError(error)) {
      appError = error
    } else {
      // Convert generic Error to AppError
      appError = this.convertToAppError(error)
    }

    // Log error for debugging
    console.error('Error occurred:', appError, context)

    // Notify listeners
    this.errorListeners.forEach(listener => listener(appError, context))

    return appError
  }

  // Error recovery methods
  getRecoveryActions(error: AppError, context?: ErrorContext): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = []

    switch (error.type) {
      case 'system':
        actions.push(...this.getSystemRecoveryActions(error, context))
        break
      case 'input':
        actions.push(...this.getInputRecoveryActions(error, context))
        break
      case 'processing':
        actions.push(...this.getProcessingRecoveryActions(error, context))
        break
      case 'user':
        actions.push(...this.getUserRecoveryActions(error, context))
        break
    }

    return actions
  }

  // Error message localization
  getLocalizedMessage(error: AppError): string {
    const messageMap: Record<string, string> = {
      // System errors
      'MODEL_LOAD_FAILED': 'OCRモデルの読み込みに失敗しました。ページを再読み込みしてください。',
      'MEMORY_INSUFFICIENT': 'メモリが不足しています。他のタブを閉じて再試行してください。',
      'WASM_INIT_FAILED': 'WebAssemblyの初期化に失敗しました。ブラウザが対応していない可能性があります。',
      'STORAGE_INIT_FAILED': 'ローカルストレージの初期化に失敗しました。',
      'BROWSER_UNSUPPORTED': 'お使いのブラウザはサポートされていません。',

      // Input errors
      'INVALID_IMAGE_FORMAT': '対応していない画像形式です。JPEG、PNG、WebP形式の画像を選択してください。',
      'IMAGE_TOO_LARGE': '画像サイズが大きすぎます。10MB以下の画像を選択してください。',
      'IMAGE_TOO_SMALL': '画像が小さすぎます。より高解像度の画像を使用してください。',
      'CAMERA_ACCESS_DENIED': 'カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。',
      'FILE_READ_FAILED': 'ファイルの読み込みに失敗しました。',

      // Processing errors
      'OCR_DETECTION_FAILED': 'テキストの検出に失敗しました。画像の品質を確認してください。',
      'OCR_RECOGNITION_FAILED': 'テキストの認識に失敗しました。',
      'DATA_EXTRACTION_FAILED': 'データの抽出に失敗しました。',
      'IMAGE_PROCESSING_FAILED': '画像の処理に失敗しました。',
      'PERSPECTIVE_CORRECTION_FAILED': '透視補正に失敗しました。',

      // User errors
      'INVALID_FIELD_VALUE': '入力値が無効です。',
      'REQUIRED_FIELD_MISSING': '必須フィールドが入力されていません。',
      'INVALID_OPERATION': '無効な操作です。'
    }

    return messageMap[error.code] || error.message
  }

  // Event listeners
  addErrorListener(listener: (error: AppError, context?: ErrorContext) => void): void {
    this.errorListeners.push(listener)
  }

  removeErrorListener(listener: (error: AppError, context?: ErrorContext) => void): void {
    const index = this.errorListeners.indexOf(listener)
    if (index > -1) {
      this.errorListeners.splice(index, 1)
    }
  }

  // Private helper methods
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 
           ['system', 'input', 'processing', 'user'].includes(error.type)
  }

  private convertToAppError(error: Error): AppError {
    // Try to categorize the error based on its message or type
    if (error.message.includes('camera') || error.message.includes('Camera')) {
      return this.createInputError('CAMERA_ACCESS_DENIED', error.message)
    }
    if (error.message.includes('memory') || error.message.includes('Memory')) {
      return this.createSystemError('MEMORY_INSUFFICIENT', error.message)
    }
    if (error.message.includes('model') || error.message.includes('ONNX')) {
      return this.createSystemError('MODEL_LOAD_FAILED', error.message)
    }
    
    // Default to processing error
    return this.createProcessingError('DATA_EXTRACTION_FAILED', error.message)
  }

  private isRecoverable(type: AppError['type'], code: string): boolean {
    const recoverableCodes = {
      system: ['MODEL_LOAD_FAILED', 'STORAGE_INIT_FAILED'],
      input: ['INVALID_IMAGE_FORMAT', 'IMAGE_TOO_LARGE', 'CAMERA_ACCESS_DENIED'],
      processing: ['OCR_DETECTION_FAILED', 'OCR_RECOGNITION_FAILED', 'DATA_EXTRACTION_FAILED'],
      user: ['INVALID_FIELD_VALUE', 'REQUIRED_FIELD_MISSING']
    }

    return recoverableCodes[type]?.includes(code) || false
  }

  private getSystemRecoveryActions(error: SystemError, context?: ErrorContext): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = []

    switch (error.code) {
      case 'MODEL_LOAD_FAILED':
        actions.push({
          type: 'retry',
          label: '再試行',
          action: () => window.location.reload()
        })
        break
      case 'MEMORY_INSUFFICIENT':
        actions.push({
          type: 'fallback',
          label: 'ページを再読み込み',
          action: () => window.location.reload()
        })
        break
      case 'STORAGE_INIT_FAILED':
        actions.push({
          type: 'retry',
          label: '再試行',
          action: async () => {
            // Retry storage initialization
            if (context?.metadata?.storage) {
              await context.metadata.storage.initialize()
            }
          }
        })
        break
    }

    return actions
  }

  private getInputRecoveryActions(error: InputError, context?: ErrorContext): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = []

    switch (error.code) {
      case 'INVALID_IMAGE_FORMAT':
      case 'IMAGE_TOO_LARGE':
      case 'IMAGE_TOO_SMALL':
        actions.push({
          type: 'fallback',
          label: '別の画像を選択',
          action: () => {
            // Trigger file input click
            if (context?.metadata?.fileInput) {
              context.metadata.fileInput.click()
            }
          }
        })
        break
      case 'CAMERA_ACCESS_DENIED':
        actions.push({
          type: 'fallback',
          label: 'ファイルから選択',
          action: () => {
            if (context?.metadata?.fileInput) {
              context.metadata.fileInput.click()
            }
          }
        })
        break
    }

    return actions
  }

  private getProcessingRecoveryActions(error: ProcessingError, context?: ErrorContext): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = []

    switch (error.code) {
      case 'OCR_DETECTION_FAILED':
      case 'OCR_RECOGNITION_FAILED':
        actions.push({
          type: 'retry',
          label: '再試行',
          action: async () => {
            if (context?.metadata?.retryFunction) {
              await context.metadata.retryFunction()
            }
          }
        })
        actions.push({
          type: 'manual_input',
          label: '手動入力',
          action: () => {
            if (context?.metadata?.enableManualInput) {
              context.metadata.enableManualInput()
            }
          }
        })
        break
      case 'DATA_EXTRACTION_FAILED':
        actions.push({
          type: 'manual_input',
          label: '手動で入力',
          action: () => {
            if (context?.metadata?.enableManualInput) {
              context.metadata.enableManualInput()
            }
          }
        })
        break
    }

    return actions
  }

  private getUserRecoveryActions(error: UserError, context?: ErrorContext): ErrorRecoveryAction[] {
    const actions: ErrorRecoveryAction[] = []

    switch (error.code) {
      case 'INVALID_FIELD_VALUE':
      case 'REQUIRED_FIELD_MISSING':
        actions.push({
          type: 'manual_input',
          label: '入力を修正',
          action: () => {
            if (context?.metadata?.focusField) {
              context.metadata.focusField()
            }
          }
        })
        break
    }

    return actions
  }
}

export const errorHandler = ErrorHandler.getInstance()