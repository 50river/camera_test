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