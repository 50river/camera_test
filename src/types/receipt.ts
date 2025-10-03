export interface Point {
  x: number
  y: number
}

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface PerspectiveParams {
  corners: Point[]
  transformMatrix: number[][]
}

export interface FieldResult {
  value: string
  confidence: number
  candidates: string[]
  bbox?: Rectangle
}

export interface ReceiptData {
  date: FieldResult
  payee: FieldResult
  amount: FieldResult
  usage: FieldResult
  metadata: {
    processedAt: Date
    imageHash: string
  }
}

export interface ProcessingStep {
  type: 'auto_ocr' | 'manual_region' | 'user_edit'
  timestamp: Date
  field?: string
  oldValue?: string
  newValue?: string
  confidence?: number
}

export interface Receipt {
  id: string
  imageData: ImageData
  extractedData: ReceiptData
  processingHistory: ProcessingStep[]
  createdAt: Date
  updatedAt: Date
}