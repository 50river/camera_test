// Example usage of the DataExtractionEngine and NormalizationEngine
import { ReceiptDataExtractor, ReceiptNormalizationEngine } from './index'
import { OCRResult } from '../types'

// Example OCR results from a Japanese receipt
const exampleOCRResults: OCRResult[] = [
  {
    text: '株式会社サンプル商店',
    confidence: 0.95,
    bbox: { x: 50, y: 20, width: 200, height: 25 },
    candidates: ['株式会社サンプル商店']
  },
  {
    text: '2024年1月15日',
    confidence: 0.92,
    bbox: { x: 50, y: 50, width: 120, height: 18 },
    candidates: ['2024年1月15日']
  },
  {
    text: '会議用弁当',
    confidence: 0.88,
    bbox: { x: 50, y: 120, width: 100, height: 16 },
    candidates: ['会議用弁当']
  },
  {
    text: '合計 ¥1,500',
    confidence: 0.90,
    bbox: { x: 50, y: 200, width: 90, height: 18 },
    candidates: ['合計 ¥1,500']
  }
]

// Initialize engines
const extractor = new ReceiptDataExtractor()
const normalizer = new ReceiptNormalizationEngine()

// Extract receipt data
const extractedData = extractor.extractReceiptData(exampleOCRResults)

console.log('Extracted Receipt Data:')
console.log('Date:', extractedData.date.value, '(confidence:', extractedData.date.confidence, ')')
console.log('Payee:', extractedData.payee.value, '(confidence:', extractedData.payee.confidence, ')')
console.log('Amount:', extractedData.amount.value, '(confidence:', extractedData.amount.confidence, ')')
console.log('Usage:', extractedData.usage.value, '(confidence:', extractedData.usage.confidence, ')')

// Normalize the extracted data
const normalizedDate = normalizer.normalizeDate(extractedData.date.value)
const normalizedAmount = normalizer.normalizeAmount(extractedData.amount.value)
const normalizedPayee = normalizer.normalizePayee(extractedData.payee.value)
const normalizedUsage = normalizer.normalizeUsage(extractedData.usage.value)

console.log('\nNormalized Data:')
console.log('Date:', normalizedDate)
console.log('Amount:', normalizedAmount)
console.log('Payee:', normalizedPayee)
console.log('Usage:', normalizedUsage)

export { exampleOCRResults, extractor, normalizer }