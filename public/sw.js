// Service Worker for Receipt OCR PWA
// Provides offline functionality and caching

const CACHE_NAME = 'receipt-ocr-v1'
const STATIC_CACHE_NAME = 'receipt-ocr-static-v1'
const DYNAMIC_CACHE_NAME = 'receipt-ocr-dynamic-v1'

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/models/det_model.onnx',
  '/models/rec_model.onnx'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets...')
        return cache.addAll(STATIC_ASSETS.filter(url => url !== '/models/det_model.onnx' && url !== '/models/rec_model.onnx'))
      })
      .then(() => {
        // Cache ONNX models separately with error handling
        return caches.open(STATIC_CACHE_NAME)
          .then(cache => {
            const modelPromises = ['/models/det_model.onnx', '/models/rec_model.onnx'].map(url => {
              return fetch(url)
                .then(response => {
                  if (response.ok) {
                    return cache.put(url, response)
                  }
                  console.warn(`Failed to cache model: ${url}`)
                })
                .catch(error => {
                  console.warn(`Error caching model ${url}:`, error)
                })
            })
            return Promise.allSettled(modelPromises)
          })
      })
      .then(() => {
        console.log('Static assets cached successfully')
        // Skip waiting to activate immediately
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('Error caching static assets:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('Service Worker activated')
        // Take control of all clients immediately
        return self.clients.claim()
      })
  )
})

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip cross-origin requests (except for same-origin)
  if (url.origin !== location.origin) {
    return
  }

  event.respondWith(
    handleFetch(request)
  )
})

async function handleFetch(request) {
  const url = new URL(request.url)
  
  try {
    // Strategy 1: Cache First for static assets and ONNX models
    if (isStaticAsset(url.pathname)) {
      return await cacheFirst(request)
    }
    
    // Strategy 2: Network First for API calls and dynamic content
    if (isDynamicContent(url.pathname)) {
      return await networkFirst(request)
    }
    
    // Strategy 3: Stale While Revalidate for other assets
    return await staleWhileRevalidate(request)
    
  } catch (error) {
    console.error('Fetch error:', error)
    
    // Fallback to offline page for navigation requests
    if (request.mode === 'navigate') {
      return await caches.match('/') || new Response('Offline', { status: 503 })
    }
    
    // Return error response for other requests
    return new Response('Network error', { status: 503 })
  }
}

// Cache First strategy - good for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }
  
  const networkResponse = await fetch(request)
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE_NAME)
    cache.put(request, networkResponse.clone())
  }
  
  return networkResponse
}

// Network First strategy - good for dynamic content
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

// Stale While Revalidate strategy - good for frequently updated assets
async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request)
  
  const networkResponsePromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE_NAME)
      cache.then(c => c.put(request, response.clone()))
    }
    return response
  }).catch(() => {
    // Network failed, but we might have cache
    return cachedResponse
  })
  
  return cachedResponse || networkResponsePromise
}

// Helper functions
function isStaticAsset(pathname) {
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/models/') ||
    pathname.startsWith('/icons/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.onnx')
  )
}

function isDynamicContent(pathname) {
  return (
    pathname.startsWith('/api/') ||
    pathname.includes('?') // Query parameters usually indicate dynamic content
  )
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  const { type, payload } = event.data
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', payload: size })
      })
      break
      
    case 'CLEAR_CACHE':
      clearCache(payload?.cacheName).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' })
      })
      break
      
    case 'PRELOAD_MODELS':
      preloadModels().then(() => {
        event.ports[0].postMessage({ type: 'MODELS_PRELOADED' })
      })
      break
  }
})

// Cache management utilities
async function getCacheSize() {
  const cacheNames = await caches.keys()
  let totalSize = 0
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName)
    const requests = await cache.keys()
    
    for (const request of requests) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }
  
  return totalSize
}

async function clearCache(cacheName) {
  if (cacheName) {
    return caches.delete(cacheName)
  } else {
    const cacheNames = await caches.keys()
    return Promise.all(cacheNames.map(name => caches.delete(name)))
  }
}

async function preloadModels() {
  const cache = await caches.open(STATIC_CACHE_NAME)
  const modelUrls = ['/models/det_model.onnx', '/models/rec_model.onnx']
  
  const promises = modelUrls.map(async (url) => {
    try {
      const response = await fetch(url)
      if (response.ok) {
        await cache.put(url, response)
        console.log(`Preloaded model: ${url}`)
      }
    } catch (error) {
      console.warn(`Failed to preload model ${url}:`, error)
    }
  })
  
  return Promise.allSettled(promises)
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-receipts') {
    event.waitUntil(syncReceiptData())
  }
})

async function syncReceiptData() {
  // This would sync any offline receipt data when connection is restored
  console.log('Background sync: Receipt data')
  // Implementation would depend on your data sync requirements
}

// Push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: data.data,
      actions: data.actions
    }
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})