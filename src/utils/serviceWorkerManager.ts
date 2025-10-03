/**
 * Service Worker Manager
 * Handles service worker registration, updates, and communication
 */

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager
  private registration: ServiceWorkerRegistration | null = null
  private updateAvailable = false
  private callbacks: Map<string, Function[]> = new Map()

  private constructor() {}

  public static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager()
    }
    return ServiceWorkerManager.instance
  }

  /**
   * Register service worker
   */
  public async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported')
      return
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('Service Worker registered:', this.registration)

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              this.updateAvailable = true
              this.emit('updateAvailable')
            }
          })
        }
      })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event.data)
      })

      // Check for existing update
      if (this.registration.waiting) {
        this.updateAvailable = true
        this.emit('updateAvailable')
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error)
      throw error
    }
  }

  /**
   * Update service worker
   */
  public async update(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered')
    }

    if (this.registration.waiting) {
      // Tell the waiting service worker to skip waiting
      this.postMessage({ type: 'SKIP_WAITING' })
      
      // Reload the page to activate the new service worker
      window.location.reload()
    } else {
      // Check for updates
      await this.registration.update()
    }
  }

  /**
   * Get cache size
   */
  public async getCacheSize(): Promise<number> {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_SIZE') {
          resolve(event.data.payload)
        } else {
          reject(new Error('Failed to get cache size'))
        }
      }

      this.postMessage({ type: 'GET_CACHE_SIZE' }, [messageChannel.port2])
    })
  }

  /**
   * Clear cache
   */
  public async clearCache(cacheName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          resolve()
        } else {
          reject(new Error('Failed to clear cache'))
        }
      }

      this.postMessage({ 
        type: 'CLEAR_CACHE', 
        payload: { cacheName } 
      }, [messageChannel.port2])
    })
  }

  /**
   * Preload models
   */
  public async preloadModels(): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'MODELS_PRELOADED') {
          resolve()
        } else {
          reject(new Error('Failed to preload models'))
        }
      }

      this.postMessage({ type: 'PRELOAD_MODELS' }, [messageChannel.port2])
    })
  }

  /**
   * Check if app is running offline
   */
  public isOffline(): boolean {
    return !navigator.onLine
  }

  /**
   * Get installation status
   */
  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true
  }

  /**
   * Check if update is available
   */
  public hasUpdateAvailable(): boolean {
    return this.updateAvailable
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, [])
    }
    this.callbacks.get(event)!.push(callback)
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: Function): void {
    const callbacks = this.callbacks.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.callbacks.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  /**
   * Post message to service worker
   */
  private postMessage(message: any, transfer?: Transferable[]): void {
    if (navigator.serviceWorker.controller) {
      if (transfer) {
        navigator.serviceWorker.controller.postMessage(message, { transfer })
      } else {
        navigator.serviceWorker.controller.postMessage(message)
      }
    }
  }

  /**
   * Handle message from service worker
   */
  private handleMessage(data: any): void {
    switch (data.type) {
      case 'CACHE_UPDATED':
        this.emit('cacheUpdated', data.payload)
        break
      case 'OFFLINE_READY':
        this.emit('offlineReady')
        break
      default:
        console.log('Unknown message from service worker:', data)
    }
  }

  /**
   * Get service worker status
   */
  public getStatus() {
    return {
      registered: !!this.registration,
      updateAvailable: this.updateAvailable,
      offline: this.isOffline(),
      installed: this.isInstalled(),
      controller: !!navigator.serviceWorker.controller
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance()

// React hook for service worker
export function useServiceWorker() {
  const [status, setStatus] = React.useState(serviceWorkerManager.getStatus())
  const [cacheSize, setCacheSize] = React.useState<number | null>(null)

  React.useEffect(() => {
    const updateStatus = () => setStatus(serviceWorkerManager.getStatus())
    
    serviceWorkerManager.on('updateAvailable', updateStatus)
    serviceWorkerManager.on('offlineReady', updateStatus)
    serviceWorkerManager.on('cacheUpdated', updateStatus)

    // Update status on online/offline changes
    const handleOnline = () => updateStatus()
    const handleOffline = () => updateStatus()
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Get initial cache size
    serviceWorkerManager.getCacheSize()
      .then(setCacheSize)
      .catch(() => setCacheSize(null))

    return () => {
      serviceWorkerManager.off('updateAvailable', updateStatus)
      serviceWorkerManager.off('offlineReady', updateStatus)
      serviceWorkerManager.off('cacheUpdated', updateStatus)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const update = React.useCallback(() => {
    return serviceWorkerManager.update()
  }, [])

  const clearCache = React.useCallback((cacheName?: string) => {
    return serviceWorkerManager.clearCache(cacheName).then(() => {
      return serviceWorkerManager.getCacheSize().then(setCacheSize)
    })
  }, [])

  const preloadModels = React.useCallback(() => {
    return serviceWorkerManager.preloadModels()
  }, [])

  return {
    status,
    cacheSize,
    update,
    clearCache,
    preloadModels
  }
}

// Add React import for the hook
import React from 'react'