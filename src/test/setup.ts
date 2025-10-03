// Test setup for Vitest
// This file is loaded before all tests

import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock ONNX runtime for tests
;(global as any).InferenceSession = {
  create: vi.fn().mockResolvedValue({
    run: vi.fn().mockResolvedValue({})
  })
}

// Mock Canvas API
global.HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  drawImage: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn().mockReturnValue({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1
  }),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn()
})

// Mock File API
global.FileReader = class {
  readAsDataURL = vi.fn()
  readAsArrayBuffer = vi.fn()
  onload = null
  onerror = null
  result = null
} as any

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock ImageData
global.ImageData = class {
  data: Uint8ClampedArray
  width: number
  height: number
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.data = new Uint8ClampedArray(width * height * 4)
  }
} as any

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => []
    })
  }
})

// Mock IndexedDB
const mockIDBRequest = {
  result: null as any,
  error: null,
  onsuccess: null as any,
  onerror: null as any,
  onupgradeneeded: null as any
}

const mockIDBDatabase = {
  transaction: vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue({
      add: vi.fn().mockReturnValue(mockIDBRequest),
      put: vi.fn().mockReturnValue(mockIDBRequest),
      get: vi.fn().mockReturnValue(mockIDBRequest),
      getAll: vi.fn().mockReturnValue(mockIDBRequest),
      delete: vi.fn().mockReturnValue(mockIDBRequest),
      clear: vi.fn().mockReturnValue(mockIDBRequest),
      createIndex: vi.fn(),
      index: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(mockIDBRequest),
        getAll: vi.fn().mockReturnValue(mockIDBRequest)
      })
    })
  }),
  createObjectStore: vi.fn().mockReturnValue({
    createIndex: vi.fn()
  }),
  close: vi.fn()
}

global.indexedDB = {
  open: vi.fn().mockImplementation(() => {
    const request = { ...mockIDBRequest }
    setTimeout(() => {
      request.result = mockIDBDatabase as any
      if (request.onsuccess) (request.onsuccess as any)({ target: request } as any)
    }, 0)
    return request
  }),
  deleteDatabase: vi.fn().mockReturnValue(mockIDBRequest)
} as any

// Mock IDBKeyRange
global.IDBKeyRange = {
  bound: vi.fn(),
  only: vi.fn(),
  lowerBound: vi.fn(),
  upperBound: vi.fn()
} as any

// Mock Worker
global.Worker = class {
  onmessage = null
  onerror = null
  onmessageerror = null
  
  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    // Mock worker that doesn't actually run
  }
  
  postMessage = vi.fn()
  terminate = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  dispatchEvent = vi.fn()
} as any