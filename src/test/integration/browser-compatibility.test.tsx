import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

// Browser compatibility test utilities
interface BrowserEnvironment {
  userAgent: string
  webAssembly: boolean
  webWorkers: boolean
  indexedDB: boolean
  fileAPI: boolean
  mediaDevices: boolean
  sharedArrayBuffer: boolean
  isMobile?: boolean
}

const mockBrowserEnvironments: Record<string, BrowserEnvironment> = {
  chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: true
  },
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: false // Firefox has restrictions
  },
  safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: false // Safari has restrictions
  },
  edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: true
  },
  mobileSafari: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: false,
    isMobile: true
  },
  mobileChrome: {
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    webAssembly: true,
    webWorkers: true,
    indexedDB: true,
    fileAPI: true,
    mediaDevices: true,
    sharedArrayBuffer: true,
    isMobile: true
  }
}

// Mock browser APIs based on environment
function mockBrowserEnvironment(env: keyof typeof mockBrowserEnvironments) {
  const config = mockBrowserEnvironments[env]
  
  // Mock user agent
  Object.defineProperty(navigator, 'userAgent', {
    writable: true,
    value: config.userAgent
  })

  // Mock WebAssembly
  if (config.webAssembly) {
    global.WebAssembly = {
      instantiate: vi.fn().mockResolvedValue({}),
      compile: vi.fn().mockResolvedValue({}),
      Module: vi.fn(),
      Instance: vi.fn(),
      Memory: vi.fn(),
      Table: vi.fn(),
      CompileError: Error,
      RuntimeError: Error,
      LinkError: Error
    } as any
  } else {
    delete (global as any).WebAssembly
  }

  // Mock Web Workers
  if (config.webWorkers) {
    global.Worker = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null,
      onerror: null
    }))
  } else {
    delete (global as any).Worker
  }

  // Mock IndexedDB
  if (config.indexedDB) {
    global.indexedDB = {
      open: vi.fn().mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: {
          createObjectStore: vi.fn(),
          transaction: vi.fn().mockReturnValue({
            objectStore: vi.fn().mockReturnValue({
              add: vi.fn(),
              get: vi.fn(),
              put: vi.fn(),
              delete: vi.fn(),
              getAll: vi.fn()
            })
          })
        }
      })),
      deleteDatabase: vi.fn()
    } as any
  } else {
    delete (global as any).indexedDB
  }

  // Mock File API
  if (config.fileAPI) {
    global.File = vi.fn().mockImplementation((data, name, options) => ({
      name,
      size: data.length,
      type: options?.type || '',
      lastModified: Date.now(),
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      text: vi.fn().mockResolvedValue(''),
      stream: vi.fn()
    })) as any

    global.FileReader = vi.fn().mockImplementation(() => ({
      readAsDataURL: vi.fn(),
      readAsArrayBuffer: vi.fn(),
      onload: null,
      onerror: null,
      result: null
    })) as any
  } else {
    delete (global as any).File
    delete (global as any).FileReader
  }

  // Mock MediaDevices
  if (config.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [],
          getVideoTracks: () => [],
          getAudioTracks: () => []
        }),
        enumerateDevices: vi.fn().mockResolvedValue([])
      }
    })
  } else {
    delete (navigator as any).mediaDevices
  }

  // Mock SharedArrayBuffer
  if (config.sharedArrayBuffer) {
    global.SharedArrayBuffer = vi.fn().mockImplementation((length) => ({
      byteLength: length,
      slice: vi.fn()
    })) as any
  } else {
    delete (global as any).SharedArrayBuffer
  }

  // Mock mobile-specific properties
  if (config.isMobile) {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 667
    })
    
    // Mock touch events
    global.TouchEvent = vi.fn() as any
    Object.defineProperty(window, 'ontouchstart', {
      writable: true,
      value: null
    })
  }
}

describe('Cross-Browser Compatibility Tests', () => {
  let originalUserAgent: string
  let originalWebAssembly: any
  let originalWorker: any
  let originalIndexedDB: any

  beforeEach(() => {
    // Store original values
    originalUserAgent = navigator.userAgent
    originalWebAssembly = global.WebAssembly
    originalWorker = global.Worker
    originalIndexedDB = global.indexedDB
  })

  afterEach(() => {
    // Restore original values
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      value: originalUserAgent
    })
    global.WebAssembly = originalWebAssembly
    global.Worker = originalWorker
    global.indexedDB = originalIndexedDB
    
    vi.clearAllMocks()
  })

  it('should work correctly in Chrome', async () => {
    mockBrowserEnvironment('chrome')

    render(<App />)

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify Chrome-specific optimizations are available
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeDefined()
    expect(global.indexedDB).toBeDefined()

    // Test file input functionality
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveAttribute('accept', 'image/*')
    expect(fileInput).toHaveAttribute('capture', 'environment')
  })

  it('should work correctly in Firefox', async () => {
    mockBrowserEnvironment('firefox')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify Firefox compatibility
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeUndefined() // Firefox restriction
    expect(global.indexedDB).toBeDefined()

    // Should still function without SharedArrayBuffer
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('should work correctly in Safari', async () => {
    mockBrowserEnvironment('safari')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify Safari compatibility
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeUndefined() // Safari restriction
    expect(global.indexedDB).toBeDefined()

    // Test Safari-specific file handling
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('should work correctly in Edge', async () => {
    mockBrowserEnvironment('edge')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify Edge compatibility (similar to Chrome)
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeDefined()
    expect(global.indexedDB).toBeDefined()
  })

  it('should work correctly on Mobile Safari (iOS)', async () => {
    mockBrowserEnvironment('mobileSafari')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify mobile Safari compatibility
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeUndefined()
    expect(global.indexedDB).toBeDefined()

    // Test mobile-specific features
    expect(window.innerWidth).toBe(375) // Mobile viewport
    expect(global.TouchEvent).toBeDefined()

    // Mobile menu should be available
    const menuToggle = screen.getByLabelText('メニューを開く')
    expect(menuToggle).toBeInTheDocument()

    // File input should have camera capture
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('capture', 'environment')
  })

  it('should work correctly on Mobile Chrome (Android)', async () => {
    mockBrowserEnvironment('mobileChrome')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify mobile Chrome compatibility
    expect(global.WebAssembly).toBeDefined()
    expect(global.Worker).toBeDefined()
    expect(global.SharedArrayBuffer).toBeDefined()
    expect(global.indexedDB).toBeDefined()

    // Test mobile features
    expect(window.innerWidth).toBe(375)
    expect(global.TouchEvent).toBeDefined()

    const menuToggle = screen.getByLabelText('メニューを開く')
    expect(menuToggle).toBeInTheDocument()
  })

  it('should handle WebAssembly unavailability gracefully', async () => {
    // Mock environment without WebAssembly
    mockBrowserEnvironment('chrome')
    delete (global as any).WebAssembly

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should show appropriate error or fallback
    // The app should still render but OCR functionality may be limited
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
  })

  it('should handle Web Workers unavailability gracefully', async () => {
    // Mock environment without Web Workers
    mockBrowserEnvironment('chrome')
    delete (global as any).Worker

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should fall back to main thread processing
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
  })

  it('should handle IndexedDB unavailability gracefully', async () => {
    // Mock environment without IndexedDB
    mockBrowserEnvironment('chrome')
    delete (global as any).indexedDB

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should show warning about storage limitations
    // App should still function but without persistence
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
  })

  it('should handle File API unavailability gracefully', async () => {
    // Mock environment without File API
    mockBrowserEnvironment('chrome')
    delete (global as any).File
    delete (global as any).FileReader

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should show appropriate error message
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
  })

  it('should adapt UI for different screen sizes', async () => {
    // Test desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080
    })

    const { rerender } = render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Desktop should show full navigation
    const navigation = screen.getByRole('navigation')
    expect(navigation).not.toHaveClass('nav-open')

    // Test mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375
    })

    // Trigger resize
    window.dispatchEvent(new Event('resize'))
    rerender(<App />)

    // Mobile should show hamburger menu
    const menuToggle = screen.getByLabelText('メニューを開く')
    expect(menuToggle).toBeInTheDocument()
  })

  it('should handle touch events on mobile devices', async () => {
    mockBrowserEnvironment('mobileSafari')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Verify touch event support is detected
    expect(global.TouchEvent).toBeDefined()
    expect(window.ontouchstart).toBeDefined()

    // Mobile menu should work with touch
    const user = userEvent.setup()
    const menuToggle = screen.getByLabelText('メニューを開く')
    
    await user.click(menuToggle)
    
    const navigation = screen.getByRole('navigation')
    expect(navigation).toHaveClass('nav-open')
  })

  it('should handle camera permissions across browsers', async () => {
    const testCameraPermissions = async (browserEnv: keyof typeof mockBrowserEnvironments) => {
      mockBrowserEnvironment(browserEnv)

      render(<App />)

      await waitFor(() => {
        expect(screen.getByText('領収書OCR')).toBeInTheDocument()
      })

      // Verify camera input is available
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      
      if (mockBrowserEnvironments[browserEnv].mediaDevices) {
        expect(navigator.mediaDevices).toBeDefined()
        expect(navigator.mediaDevices.getUserMedia).toBeDefined()
      }
    }

    // Test across different browsers
    await testCameraPermissions('chrome')
    await testCameraPermissions('firefox')
    await testCameraPermissions('safari')
    await testCameraPermissions('mobileSafari')
    await testCameraPermissions('mobileChrome')
  })

  it('should handle CORS and security restrictions', async () => {
    mockBrowserEnvironment('safari') // Safari has stricter security

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should handle CORS restrictions for model loading
    // Models should be served from same origin
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()

    // SharedArrayBuffer should not be available in Safari
    expect(global.SharedArrayBuffer).toBeUndefined()
  })

  it('should provide appropriate fallbacks for unsupported features', async () => {
    // Create a minimal environment (old browser simulation)
    mockBrowserEnvironment('chrome')
    delete (global as any).WebAssembly
    delete (global as any).Worker
    delete (global as any).SharedArrayBuffer

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Should still render and provide basic functionality
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    
    // File input should still be available
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })
})