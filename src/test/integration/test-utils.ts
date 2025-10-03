// Shared utilities for integration tests
import { vi, expect } from 'vitest'

/**
 * Creates a mock ImageData object for testing
 */
export function createMockImageData(width = 400, height = 600): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)

  // Fill with some pattern to simulate image data
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 128     // R
    data[i + 1] = 128 // G
    data[i + 2] = 128 // B
    data[i + 3] = 255 // A
  }

  return new ImageData(data, width, height)
}

/**
 * Creates a mock File object for testing image uploads
 */
export function createMockImageFile(name = 'receipt.jpg', type = 'image/jpeg'): File {
  const content = 'mock image data'
  return new File([content], name, { type })
}

/**
 * Simulates file upload with FileReader
 */
export async function simulateFileUpload(file: File, result = 'data:image/jpeg;base64,mockdata') {
  const mockFileReader = {
    readAsDataURL: vi.fn(),
    onload: null as any,
    onerror: null as any,
    result
  }

  const MockFileReader = vi.fn().mockImplementation(() => mockFileReader) as any
  MockFileReader.EMPTY = 0
  MockFileReader.LOADING = 1
  MockFileReader.DONE = 2
  global.FileReader = MockFileReader

  // Simulate successful file read
  setTimeout(() => {
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: { result } } as any)
    }
  }, 0)

  return mockFileReader
}

/**
 * Mock OCR results for different receipt types
 */
export const mockOCRResults = {
  japanese_receipt: [
    {
      text: '株式会社テスト',
      confidence: 0.95,
      bbox: { x: 50, y: 30, width: 150, height: 25 },
      candidates: ['株式会社テスト']
    },
    {
      text: '2024/01/15',
      confidence: 0.92,
      bbox: { x: 80, y: 60, width: 80, height: 18 },
      candidates: ['2024/01/15']
    },
    {
      text: '合計 ¥1,000',
      confidence: 0.88,
      bbox: { x: 150, y: 200, width: 100, height: 20 },
      candidates: ['合計 ¥1,000']
    }
  ],

  low_quality: [
    {
      text: '???会社',
      confidence: 0.45,
      bbox: { x: 50, y: 30, width: 100, height: 25 },
      candidates: ['???会社', '株式会社']
    },
    {
      text: '202?/??/15',
      confidence: 0.40,
      bbox: { x: 80, y: 60, width: 80, height: 18 },
      candidates: ['202?/??/15', '2024/01/15']
    }
  ]
}

/**
 * Creates a mock receipt data object
 */
export function createMockReceiptData() {
  return {
    date: { value: '2024/01/15', confidence: 0.95, candidates: ['2024/01/15'] },
    payee: { value: '株式会社テスト', confidence: 0.92, candidates: ['株式会社テスト'] },
    amount: { value: '1000', confidence: 0.88, candidates: ['1000'] },
    usage: { value: '飲食代', confidence: 0.85, candidates: ['飲食代'] },
    metadata: { processedAt: new Date(), imageHash: 'test-hash' }
  }
}

/**
 * Waits for async operations to complete
 */
export function waitForAsync(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Creates a mock performance info object
 */
export function createMockPerformanceInfo() {
  return {
    modelCache: {
      totalSize: 1024 * 1024, // 1MB
      maxSize: 10 * 1024 * 1024, // 10MB
      modelCount: 2
    },
    webWorker: true,
    memoryUsage: {
      usedJSHeapSize: 50 * 1024 * 1024, // 50MB
      jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
    }
  }
}

/**
 * Mock browser environment setup
 */
export function setupMockBrowser() {
  // Mock Canvas API
  global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn().mockReturnValue(createMockImageData(100, 100)),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    canvas: { width: 100, height: 100 }
  })

  // Mock URL API
  global.URL.createObjectURL = vi.fn().mockReturnValue('mock-blob-url')
  global.URL.revokeObjectURL = vi.fn()

  // Mock crypto API
  global.crypto = {
    randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
    getRandomValues: vi.fn().mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
      return array
    })
  } as any

  // Mock performance API
  global.performance = {
    ...global.performance,
    now: vi.fn().mockReturnValue(Date.now()),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      jsHeapSizeLimit: 100 * 1024 * 1024,
      totalJSHeapSize: 60 * 1024 * 1024
    }
  } as any
}

/**
 * Cleanup mock browser environment
 */
export function cleanupMockBrowser() {
  vi.clearAllMocks()

  // Reset any global modifications
  delete (global as any).crypto
  delete (global as any).performance
}

/**
 * Assert that an element is visible and accessible
 */
export function assertElementAccessible(element: HTMLElement) {
  expect(element).toBeInTheDocument()
  expect(element).toBeVisible()

  // Check for accessibility attributes
  if (element.tagName === 'BUTTON') {
    expect(element).not.toHaveAttribute('disabled')
  }

  if (element.tagName === 'INPUT') {
    const label = document.querySelector(`label[for="${element.id}"]`)
    if (!label && !element.getAttribute('aria-label')) {
      console.warn('Input element may not be properly labeled for accessibility')
    }
  }
}

/**
 * Simulate network conditions for testing
 */
export function simulateNetworkConditions(condition: 'fast' | 'slow' | 'offline') {
  const delays = {
    fast: 10,
    slow: 1000,
    offline: Infinity
  }

  const delay = delays[condition]

  // Mock fetch with delay
  global.fetch = vi.fn().mockImplementation(() => {
    if (condition === 'offline') {
      return Promise.reject(new Error('Network error'))
    }

    return new Promise(resolve => {
      setTimeout(() => {
        resolve(new Response('{}', { status: 200 }))
      }, delay)
    })
  })
}

/**
 * Test data for different receipt formats
 */
export const testReceiptFormats = {
  japanese_corporate: {
    payee: '株式会社サンプル',
    date: '2024年1月15日',
    amount: '¥1,500',
    items: ['商品A', '商品B']
  },

  convenience_store: {
    payee: 'セブン-イレブン 渋谷店',
    date: 'R6.01.15',
    amount: '238円',
    items: ['おにぎり', 'お茶']
  },

  restaurant: {
    payee: '居酒屋 田中',
    date: '2024-01-15',
    amount: '3,500円',
    items: ['生ビール', '焼き鳥', 'お通し']
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceMonitor {
  private startTime: number = 0
  private measurements: { [key: string]: number } = {}

  start(label: string) {
    this.startTime = performance.now()
    this.measurements[label + '_start'] = this.startTime
  }

  end(label: string) {
    const endTime = performance.now()
    const duration = endTime - this.startTime
    this.measurements[label + '_duration'] = duration
    return duration
  }

  getMeasurements() {
    return { ...this.measurements }
  }

  assertPerformance(label: string, maxDuration: number) {
    const duration = this.measurements[label + '_duration']
    expect(duration).toBeLessThan(maxDuration)
  }
}