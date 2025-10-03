import { Rectangle } from './receipt'

export interface TextDetection {
  bbox: Rectangle
  confidence: number
}

export interface TextRecognition {
  text: string
  confidence: number
  bbox: Rectangle
}

export interface OCRResult {
  text: string
  confidence: number
  bbox: Rectangle
  candidates: string[]
}

export interface OCREngine {
  initialize(): Promise<void>
  detectText(image: ImageData): Promise<TextDetection[]>
  recognizeText(image: ImageData, regions: TextDetection[]): Promise<TextRecognition[]>
  processFullImage(image: ImageData): Promise<OCRResult[]>
  processRegion(image: ImageData, region: Rectangle): Promise<OCRResult[]>
}