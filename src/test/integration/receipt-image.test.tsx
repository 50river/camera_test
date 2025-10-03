import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaddleOCREngine } from '../../engines/OCREngine'
import { ReceiptDataExtractor } from '../../engines/DataExtractionEngine'
import { CameraCapture } from '../../components/CameraCapture'
import { ImagePreview } from '../../components/ImagePreview'
import { ReceiptForm } from '../../components/ReceiptForm'

// Test data representing realistic Japanese receipt OCR results
const mockReceiptOCRResults = {
  starbucks: [
    {
      text: 'スターバックス コーヒー ジャパン 株式会社',
      confidence: 0.95,
      bbox: { x: 50, y: 30, width: 300, height: 25 },
      candidates: ['スターバックス コーヒー ジャパン 株式会社']
    },
    {
      text: '2024年1月15日 14:32',
      confidence: 0.92,
      bbox: { x: 80, y: 60, width: 150, height: 18 },
      candidates: ['2024年1月15日 14:32']
    },
    {
      text: 'ドリップコーヒー トール',
      confidence: 0.88,
      bbox: { x: 60, y: 120, width: 180, height: 20 },
      candidates: ['ドリップコーヒー トール']
    },
    {
      text: '¥350',
      confidence: 0.90,
      bbox: { x: 280, y: 120, width: 50, height: 20 },
      candidates: ['¥350']
    },
    {
      text: 'カフェラテ グランデ',
      confidence: 0.85,
      bbox: { x: 60, y: 145, width: 160, height: 20 },
      candidates: ['カフェラテ グランデ']
    },
    {
      text: '¥420',
      confidence: 0.89,
      bbox: { x: 280, y: 145, width: 50, height: 20 },
      candidates: ['¥420']
    },
    {
      text: '小計',
      confidence: 0.93,
      bbox: { x: 60, y: 180, width: 40, height: 18 },
      candidates: ['小計']
    },
    {
      text: '¥770',
      confidence: 0.91,
      bbox: { x: 280, y: 180, width: 50, height: 18 },
      candidates: ['¥770']
    },
    {
      text: '消費税',
      confidence: 0.90,
      bbox: { x: 60, y: 200, width: 60, height: 18 },
      candidates: ['消費税']
    },
    {
      text: '¥77',
      confidence: 0.88,
      bbox: { x: 280, y: 200, width: 40, height: 18 },
      candidates: ['¥77']
    },
    {
      text: '合計',
      confidence: 0.95,
      bbox: { x: 60, y: 230, width: 40, height: 22 },
      candidates: ['合計']
    },
    {
      text: '¥847',
      confidence: 0.94,
      bbox: { x: 280, y: 230, width: 50, height: 22 },
      candidates: ['¥847']
    }
  ],
  
  convenience_store: [
    {
      text: 'セブン-イレブン',
      confidence: 0.93,
      bbox: { x: 100, y: 25, width: 120, height: 30 },
      candidates: ['セブン-イレブン']
    },
    {
      text: '渋谷駅前店',
      confidence: 0.89,
      bbox: { x: 120, y: 55, width: 80, height: 20 },
      candidates: ['渋谷駅前店']
    },
    {
      text: 'R6/01/20 18:45',
      confidence: 0.87,
      bbox: { x: 70, y: 80, width: 100, height: 16 },
      candidates: ['R6/01/20 18:45']
    },
    {
      text: 'おにぎり 鮭',
      confidence: 0.85,
      bbox: { x: 40, y: 120, width: 90, height: 18 },
      candidates: ['おにぎり 鮭']
    },
    {
      text: '130',
      confidence: 0.90,
      bbox: { x: 250, y: 120, width: 30, height: 18 },
      candidates: ['130']
    },
    {
      text: 'お茶 500ml',
      confidence: 0.88,
      bbox: { x: 40, y: 145, width: 80, height: 18 },
      candidates: ['お茶 500ml']
    },
    {
      text: '108',
      confidence: 0.91,
      bbox: { x: 250, y: 145, width: 30, height: 18 },
      candidates: ['108']
    },
    {
      text: '計',
      confidence: 0.92,
      bbox: { x: 40, y: 180, width: 20, height: 20 },
      candidates: ['計']
    },
    {
      text: '238円',
      confidence: 0.93,
      bbox: { x: 240, y: 180, width: 50, height: 20 },
      candidates: ['238円']
    }
  ],

  restaurant: [
    {
      text: '居酒屋 田中',
      confidence: 0.91,
      bbox: { x: 80, y: 40, width: 100, height: 25 },
      candidates: ['居酒屋 田中']
    },
    {
      text: '東京都新宿区',
      confidence: 0.85,
      bbox: { x: 70, y: 70, width: 90, height: 16 },
      candidates: ['東京都新宿区']
    },
    {
      text: '2024-01-25',
      confidence: 0.89,
      bbox: { x: 90, y: 95, width: 80, height: 18 },
      candidates: ['2024-01-25']
    },
    {
      text: '生ビール',
      confidence: 0.87,
      bbox: { x: 50, y: 130, width: 60, height: 18 },
      candidates: ['生ビール']
    },
    {
      text: '500',
      confidence: 0.90,
      bbox: { x: 200, y: 130, width: 30, height: 18 },
      candidates: ['500']
    },
    {
      text: '焼き鳥盛り合わせ',
      confidence: 0.83,
      bbox: { x: 50, y: 155, width: 120, height: 18 },
      candidates: ['焼き鳥盛り合わせ']
    },
    {
      text: '800',
      confidence: 0.88,
      bbox: { x: 200, y: 155, width: 30, height: 18 },
      candidates: ['800']
    },
    {
      text: 'お通し',
      confidence: 0.86,
      bbox: { x: 50, y: 180, width: 50, height: 18 },
      candidates: ['お通し']
    },
    {
      text: '300',
      confidence: 0.89,
      bbox: { x: 200, y: 180, width: 30, height: 18 },
      candidates: ['300']
    },
    {
      text: '合計',
      confidence: 0.94,
      bbox: { x: 50, y: 220, width: 40, height: 22 },
      candidates: ['合計']
    },
    {
      text: '1,600円',
      confidence: 0.92,
      bbox: { x: 180, y: 220, width: 60, height: 22 },
      candidates: ['1,600円']
    }
  ]
}

// Expected extraction results for each receipt type
const expectedExtractions = {
  starbucks: {
    date: '2024/01/15',
    payee: 'スターバックス コーヒー ジャパン 株式会社',
    amount: '847',
    usage: '飲食代'
  },
  convenience_store: {
    date: '2024/01/20',
    payee: 'セブン-イレブン 渋谷駅前店',
    amount: '238',
    usage: '飲食代'
  },
  restaurant: {
    date: '2024/01/25',
    payee: '居酒屋 田中',
    amount: '1600',
    usage: '接待費'
  }
}

// Mock the engines before the describe block
vi.mock('../../engines/OCREngine', () => ({
  PaddleOCREngine: vi.fn()
}))

describe('Receipt Image Processing Integration Tests', () => {
  let mockOCREngine: any
  let mockDataExtractor: any

  beforeEach(() => {
    // Setup realistic OCR engine mock
    mockOCREngine = {
      initialize: vi.fn().mockResolvedValue(undefined),
      processFullImage: vi.fn(),
      processRegion: vi.fn(),
      clearCache: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getPerformanceInfo: vi.fn().mockReturnValue({
        modelCache: { totalSize: 1024, maxSize: 2048, modelCount: 2 },
        webWorker: true
      })
    }

    // Setup realistic data extractor
    mockDataExtractor = new ReceiptDataExtractor()

    // Mock the PaddleOCREngine constructor
    vi.mocked(PaddleOCREngine).mockImplementation(() => mockOCREngine)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should correctly extract data from Starbucks receipt', async () => {
    // Setup OCR engine to return Starbucks receipt data
    mockOCREngine.processFullImage.mockResolvedValue(mockReceiptOCRResults.starbucks)

    // Process the OCR results through data extractor
    const extractedData = mockDataExtractor.extractReceiptData(mockReceiptOCRResults.starbucks)

    // Verify date extraction
    expect(extractedData.date.value).toBe(expectedExtractions.starbucks.date)
    expect(extractedData.date.confidence).toBeGreaterThan(0.8)

    // Verify payee extraction
    expect(extractedData.payee.value).toContain('スターバックス')
    expect(extractedData.payee.confidence).toBeGreaterThan(0.8)

    // Verify amount extraction (should pick up the total, not individual items)
    expect(extractedData.amount.value).toBe(expectedExtractions.starbucks.amount)
    expect(extractedData.amount.confidence).toBeGreaterThan(0.8)

    // Verify usage categorization
    expect(extractedData.usage.value).toBe(expectedExtractions.starbucks.usage)
    expect(extractedData.usage.confidence).toBeGreaterThan(0.5)

    // Verify metadata
    expect(extractedData.metadata.processedAt).toBeInstanceOf(Date)
    expect(extractedData.metadata.imageHash).toBeTruthy()
  })

  it('should correctly extract data from convenience store receipt', async () => {
    mockOCREngine.processFullImage.mockResolvedValue(mockReceiptOCRResults.convenience_store)

    const extractedData = mockDataExtractor.extractReceiptData(mockReceiptOCRResults.convenience_store)

    // Verify era date conversion (R6 = 令和6年 = 2024)
    expect(extractedData.date.value).toBe(expectedExtractions.convenience_store.date)
    expect(extractedData.date.confidence).toBeGreaterThan(0.7)

    // Verify multi-line payee extraction
    expect(extractedData.payee.value).toContain('セブン-イレブン')
    expect(extractedData.payee.confidence).toBeGreaterThan(0.7)

    // Verify amount extraction
    expect(extractedData.amount.value).toBe(expectedExtractions.convenience_store.amount)
    expect(extractedData.amount.confidence).toBeGreaterThan(0.8)

    // Verify usage categorization
    expect(extractedData.usage.value).toBe(expectedExtractions.convenience_store.usage)
  })

  it('should correctly extract data from restaurant receipt', async () => {
    mockOCREngine.processFullImage.mockResolvedValue(mockReceiptOCRResults.restaurant)

    const extractedData = mockDataExtractor.extractReceiptData(mockReceiptOCRResults.restaurant)

    // Verify date extraction (ISO format)
    expect(extractedData.date.value).toBe(expectedExtractions.restaurant.date)
    expect(extractedData.date.confidence).toBeGreaterThan(0.7)

    // Verify payee extraction
    expect(extractedData.payee.value).toContain('居酒屋')
    expect(extractedData.payee.confidence).toBeGreaterThan(0.7)

    // Verify amount extraction (with comma separator)
    expect(extractedData.amount.value).toBe(expectedExtractions.restaurant.amount)
    expect(extractedData.amount.confidence).toBeGreaterThan(0.8)

    // Verify usage categorization (should detect restaurant/entertainment)
    expect(extractedData.usage.value).toBe(expectedExtractions.restaurant.usage)
  })

  it('should handle low-quality OCR results gracefully', async () => {
    // Create low-confidence OCR results
    const lowQualityResults = mockReceiptOCRResults.starbucks.map(result => ({
      ...result,
      confidence: result.confidence * 0.5 // Reduce all confidences
    }))

    mockOCREngine.processFullImage.mockResolvedValue(lowQualityResults)

    const extractedData = mockDataExtractor.extractReceiptData(lowQualityResults)

    // Should still extract some data but with lower confidence
    expect(extractedData.date.confidence).toBeLessThan(0.8)
    expect(extractedData.payee.confidence).toBeLessThan(0.8)
    expect(extractedData.amount.confidence).toBeLessThan(0.8)
    expect(extractedData.usage.confidence).toBeLessThan(0.8)

    // Should provide candidates for manual correction
    expect(extractedData.date.candidates.length).toBeGreaterThan(0)
    expect(extractedData.payee.candidates.length).toBeGreaterThan(0)
    expect(extractedData.amount.candidates.length).toBeGreaterThan(0)
    expect(extractedData.usage.candidates.length).toBeGreaterThan(0)
  })

  it('should handle partial OCR failures', async () => {
    // Create OCR results with some missing data
    const partialResults = [
      mockReceiptOCRResults.starbucks[0], // Payee
      mockReceiptOCRResults.starbucks[11], // Amount
      // Missing date and usage items
    ]

    mockOCREngine.processFullImage.mockResolvedValue(partialResults)

    const extractedData = mockDataExtractor.extractReceiptData(partialResults)

    // Should extract available data
    expect(extractedData.payee.value).toContain('スターバックス')
    expect(extractedData.amount.value).toBe('847')

    // Should handle missing data gracefully
    expect(extractedData.date.value).toBe('') // No date found
    expect(extractedData.date.confidence).toBe(0)

    // Should provide fallback usage
    expect(extractedData.usage.value).toBeTruthy() // Should have some fallback
  })

  it('should correctly prioritize total amounts over item prices', async () => {
    // Test with receipt containing multiple amounts
    const multiAmountResults = [
      ...mockReceiptOCRResults.starbucks.slice(0, 2), // Header info
      {
        text: '¥350', // Item price
        confidence: 0.90,
        bbox: { x: 280, y: 120, width: 50, height: 20 },
        candidates: ['¥350']
      },
      {
        text: '¥420', // Another item price
        confidence: 0.89,
        bbox: { x: 280, y: 145, width: 50, height: 20 },
        candidates: ['¥420']
      },
      {
        text: '合計 ¥847', // Total amount (should be prioritized)
        confidence: 0.94,
        bbox: { x: 60, y: 230, width: 90, height: 22 },
        candidates: ['合計 ¥847']
      }
    ]

    mockOCREngine.processFullImage.mockResolvedValue(multiAmountResults)

    const extractedData = mockDataExtractor.extractReceiptData(multiAmountResults)

    // Should extract the total amount, not individual item prices
    expect(extractedData.amount.value).toBe('847')
    expect(extractedData.amount.confidence).toBeGreaterThan(0.9)
  })

  it('should handle different date formats correctly', async () => {
    const dateFormatTests = [
      {
        text: '2024年1月15日',
        expected: '2024/01/15'
      },
      {
        text: '令和6年1月15日',
        expected: '2024/01/15'
      },
      {
        text: 'R6.1.15',
        expected: '2024/01/15'
      },
      {
        text: '2024-01-15',
        expected: '2024/01/15'
      },
      {
        text: '01/15/2024',
        expected: '2024/01/15'
      }
    ]

    for (const { text, expected } of dateFormatTests) {
      const testResults = [
        {
          text,
          confidence: 0.90,
          bbox: { x: 80, y: 60, width: 100, height: 18 },
          candidates: [text]
        }
      ]

      mockOCREngine.processFullImage.mockResolvedValue(testResults)
      const extractedData = mockDataExtractor.extractReceiptData(testResults)

      expect(extractedData.date.value).toBe(expected)
    }
  })

  it('should categorize usage based on business type', async () => {
    const businessTypeTests = [
      {
        payee: 'スターバックス コーヒー',
        expectedUsage: '飲食代'
      },
      {
        payee: 'ビックカメラ',
        expectedUsage: '消耗品費'
      },
      {
        payee: 'JR東日本',
        expectedUsage: '交通費'
      },
      {
        payee: '居酒屋 田中',
        expectedUsage: '接待費'
      }
    ]

    for (const { payee, expectedUsage } of businessTypeTests) {
      const testResults = [
        {
          text: payee,
          confidence: 0.90,
          bbox: { x: 50, y: 30, width: 200, height: 25 },
          candidates: [payee]
        },
        {
          text: '¥1000',
          confidence: 0.90,
          bbox: { x: 200, y: 200, width: 50, height: 20 },
          candidates: ['¥1000']
        }
      ]

      mockOCREngine.processFullImage.mockResolvedValue(testResults)
      const extractedData = mockDataExtractor.extractReceiptData(testResults)

      expect(extractedData.usage.value).toBe(expectedUsage)
    }
  })

  it('should handle region-based re-OCR for corrections', async () => {
    // Initial OCR with incorrect amount
    const initialResults = [
      {
        text: 'スターバックス',
        confidence: 0.95,
        bbox: { x: 50, y: 30, width: 150, height: 25 },
        candidates: ['スターバックス']
      },
      {
        text: '¥84?', // Unclear amount
        confidence: 0.60,
        bbox: { x: 280, y: 230, width: 50, height: 22 },
        candidates: ['¥84?']
      }
    ]

    // Region re-OCR with corrected amount
    const regionResults = [
      {
        text: '¥847',
        confidence: 0.95,
        bbox: { x: 0, y: 0, width: 50, height: 22 },
        candidates: ['¥847']
      }
    ]

    mockOCREngine.processFullImage.mockResolvedValue(initialResults)
    mockOCREngine.processRegion.mockResolvedValue(regionResults)

    // Initial extraction
    let extractedData = mockDataExtractor.extractReceiptData(initialResults)
    expect(extractedData.amount.confidence).toBeLessThan(0.8)

    // Region-based correction
    extractedData = mockDataExtractor.addRegionCandidates(
      extractedData,
      regionResults,
      'amount'
    )

    // Should have improved confidence and correct value
    expect(extractedData.amount.value).toBe('847')
    expect(extractedData.amount.confidence).toBeGreaterThan(0.9)
    expect(extractedData.amount.candidates).toContain('847')
  })

  it('should validate extracted data reasonableness', async () => {
    // Test with unreasonable data
    const unreasonableResults = [
      {
        text: '2050/01/01', // Future date
        confidence: 0.90,
        bbox: { x: 80, y: 60, width: 80, height: 18 },
        candidates: ['2050/01/01']
      },
      {
        text: '¥999999999', // Unreasonably large amount
        confidence: 0.90,
        bbox: { x: 200, y: 200, width: 100, height: 20 },
        candidates: ['¥999999999']
      }
    ]

    mockOCREngine.processFullImage.mockResolvedValue(unreasonableResults)
    const extractedData = mockDataExtractor.extractReceiptData(unreasonableResults)

    // Should penalize unreasonable values with lower confidence
    expect(extractedData.date.confidence).toBeLessThan(0.8)
    expect(extractedData.amount.confidence).toBeLessThan(0.8)
  })
})