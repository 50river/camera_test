export interface BaseError {
  type: 'system' | 'input' | 'processing' | 'user'
  code: string
  message: string
  details?: string
  timestamp: Date
  recoverable: boolean
}

export interface SystemError extends BaseError {
  type: 'system'
  code: 
    | 'MODEL_LOAD_FAILED'
    | 'MEMORY_INSUFFICIENT'
    | 'WASM_INIT_FAILED'
    | 'STORAGE_INIT_FAILED'
    | 'BROWSER_UNSUPPORTED'
}

export interface InputError extends BaseError {
  type: 'input'
  code:
    | 'INVALID_IMAGE_FORMAT'
    | 'IMAGE_TOO_LARGE'
    | 'IMAGE_TOO_SMALL'
    | 'CAMERA_ACCESS_DENIED'
    | 'FILE_READ_FAILED'
}

export interface ProcessingError extends BaseError {
  type: 'processing'
  code:
    | 'OCR_DETECTION_FAILED'
    | 'OCR_RECOGNITION_FAILED'
    | 'DATA_EXTRACTION_FAILED'
    | 'IMAGE_PROCESSING_FAILED'
    | 'PERSPECTIVE_CORRECTION_FAILED'
}

export interface UserError extends BaseError {
  type: 'user'
  code:
    | 'INVALID_FIELD_VALUE'
    | 'REQUIRED_FIELD_MISSING'
    | 'INVALID_OPERATION'
}

export type AppError = SystemError | InputError | ProcessingError | UserError

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'manual_input' | 'skip'
  label: string
  action: () => Promise<void> | void
}

export interface ErrorContext {
  component?: string
  operation?: string
  metadata?: Record<string, any>
}

export interface ErrorState {
  error: AppError | null
  isRecovering: boolean
  recoveryActions: ErrorRecoveryAction[]
  context?: ErrorContext
}