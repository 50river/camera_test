import { describe, it, expect } from 'vitest'
import { PaddleOCREngine } from '../../engines/OCREngine'
import { ReceiptDataExtractor } from '../../engines/DataExtractionEngine'
import { ReceiptNormalizationEngine } from '../../engines/NormalizationEngine'

describe('OCR Integration Tests', () => {
  it('should create OCR engines successfully', async () => {
    // Test that engines can be instantiated
    const ocrEngine = new PaddleOCREngine()
    const dataExtractor = new ReceiptDataExtractor()
    const normalizationEngine = new ReceiptNormalizationEngine()

    expect(ocrEngine).toBeInstanceOf(PaddleOCREngine)
    expect(dataExtractor).toBeInstanceOf(ReceiptDataExtractor)
    expect(normalizationEngine).toBeInstanceOf(ReceiptNormalizationEngine)
  })

  it('should extract receipt data from sample OCR results', async () => {
    const dataExtractor = new ReceiptDataExtractor()

    // Sample OCR results
    const sampleOCRResults = [
      {
        text: '2024/01/15',
        confidence: 0.9,
        bbox: { x: 10, y: 10, width: 100, height: 20 },
        candidates: ['2024/01/15']
      },
      {
        text: '株式会社テストストア',
        confidence: 0.85,
        bbox: { x: 10, y: 40, width: 200, height: 25 },
        candidates: ['株式会社テストストア']
      },
      {
        text: '合計 ¥1,500',
        confidence: 0.88,
        bbox: { x: 10, y: 200, width: 120, height: 20 },
        candidates: ['合計 ¥1,500']
      },
      {
        text: '会議用飲食代',
        confidence: 0.82,
        bbox: { x: 10, y: 100, width: 150, height: 20 },
        candidates: ['会議用飲食代']
      }
    ]

    const extractedData = dataExtractor.extractReceiptData(sampleOCRResults)

    // Verify extracted data structure
    expect(extractedData).toHaveProperty('date')
    expect(extractedData).toHaveProperty('payee')
    expect(extractedData).toHaveProperty('amount')
    expect(extractedData).toHaveProperty('usage')
    expect(extractedData).toHaveProperty('metadata')

    // Verify date extraction
    expect(extractedData.date.value).toBe('2024/01/15')
    expect(extractedData.date.confidence).toBeGreaterThan(0)

    // Verify payee extraction
    expect(extractedData.payee.value).toContain('テストストア')
    expect(extractedData.payee.confidence).toBeGreaterThan(0)

    // Verify amount extraction
    expect(extractedData.amount.value).toBe('1500')
    expect(extractedData.amount.confidence).toBeGreaterThan(0)

    // Verify usage extraction
    expect(extractedData.usage.value).toContain('会議')
    expect(extractedData.usage.confidence).toBeGreaterThan(0)
  })

  it('should normalize extracted data correctly', async () => {
    const normalizationEngine = new ReceiptNormalizationEngine()

    // Test date normalization
    const normalizedDate = normalizationEngine.normalizeDate('2024/01/15')
    expect(normalizedDate).toBe('2024/01/15')

    // Test amount normalization
    const normalizedAmount = normalizationEngine.normalizeAmount('¥1,500')
    expect(normalizedAmount).toBe(1500)

    // Test payee normalization
    const normalizedPayee = normalizationEngine.normalizePayee('株式会社テストストア')
    expect(normalizedPayee).toBe('株式会社テストストア')

    // Test usage normalization
    const normalizedUsage = normalizationEngine.normalizeUsage('会議用飲食代')
    expect(normalizedUsage).toBe('会議費')
  })

  it('should handle OCR engine initialization', async () => {
    const ocrEngine = new PaddleOCREngine()

    // Test initialization status
    expect(typeof ocrEngine.isInitialized).toBe('function')
    
    // Test model info retrieval
    const modelInfo = ocrEngine.getModelInfo()
    expect(modelInfo).toBeDefined()
    
    // Test performance info
    const performanceInfo = ocrEngine.getPerformanceInfo()
    expect(performanceInfo).toBeDefined()
    expect(performanceInfo).toHaveProperty('modelCache')
    expect(performanceInfo).toHaveProperty('webWorker')
  })

  it('should provide OCR engine methods', async () => {
    const ocrEngine = new PaddleOCREngine()

    // Test that required methods exist
    expect(typeof ocrEngine.initialize).toBe('function')
    expect(typeof ocrEngine.isInitialized).toBe('function')
    expect(typeof ocrEngine.detectText).toBe('function')
    expect(typeof ocrEngine.recognizeText).toBe('function')
    expect(typeof ocrEngine.processFullImage).toBe('function')
    expect(typeof ocrEngine.processRegion).toBe('function')
    expect(typeof ocrEngine.getModelInfo).toBe('function')
    expect(typeof ocrEngine.getPerformanceInfo).toBe('function')
  })

  it('should provide data extraction methods', async () => {
    const dataExtractor = new ReceiptDataExtractor()

    // Test that required methods exist
    expect(typeof dataExtractor.extractReceiptData).toBe('function')
    expect(typeof dataExtractor.extractDate).toBe('function')
    expect(typeof dataExtractor.extractPayee).toBe('function')
    expect(typeof dataExtractor.extractAmount).toBe('function')
    expect(typeof dataExtractor.extractUsage).toBe('function')
  })

  it('should provide normalization methods', async () => {
    const normalizationEngine = new ReceiptNormalizationEngine()

    // Test that required methods exist
    expect(typeof normalizationEngine.normalizeDate).toBe('function')
    expect(typeof normalizationEngine.normalizeAmount).toBe('function')
    expect(typeof normalizationEngine.normalizePayee).toBe('function')
    expect(typeof normalizationEngine.normalizeUsage).toBe('function')
  })
})