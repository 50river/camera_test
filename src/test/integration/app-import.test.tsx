import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Mock the engines before importing App
vi.mock('../../engines/OCREngine', () => ({
  PaddleOCREngine: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    getPerformanceInfo: vi.fn().mockReturnValue({
      modelCache: { totalSize: 0, maxSize: 0, modelCount: 0 },
      webWorker: false
    })
  }))
}))

vi.mock('../../engines/DataExtractionEngine', () => ({
  ReceiptDataExtractor: vi.fn().mockImplementation(() => ({
    extractReceiptData: vi.fn().mockReturnValue({
      date: { value: '', confidence: 0, candidates: [] },
      payee: { value: '', confidence: 0, candidates: [] },
      amount: { value: '', confidence: 0, candidates: [] },
      usage: { value: '', confidence: 0, candidates: [] },
      metadata: { processedAt: new Date(), imageHash: '' }
    })
  }))
}))

vi.mock('../../utils/storage', () => ({
  ReceiptStorage: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getReceipts: vi.fn().mockResolvedValue([])
  }))
}))

import App from '../../App'

describe('App Import Test', () => {
  it('should import and render App component', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})