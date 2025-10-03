import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { serviceWorkerManager } from './utils/serviceWorkerManager'
import './index.css'

// Initialize the application
async function initializeAndRender() {
  try {
    // Hide loading indicator
    const loading = document.getElementById('loading')
    if (loading) {
      loading.style.display = 'none'
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await serviceWorkerManager.register()
        console.log('Service Worker registered successfully')
      } catch (error) {
        console.warn('Service Worker registration failed:', error)
      }
    }

    // Render the app - service initialization will happen in App component
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('Failed to initialize application:', error)
    
    // Hide loading indicator
    const loading = document.getElementById('loading')
    if (loading) {
      loading.style.display = 'none'
    }
    
    // Show error message to user
    const root = document.getElementById('root')!
    root.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        padding: 2rem;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      ">
        <h1 style="color: #dc3545; margin-bottom: 1rem;">アプリケーション初期化エラー</h1>
        <p style="color: #666; margin-bottom: 2rem;">
          アプリケーションの初期化に失敗しました。<br>
          ページを再読み込みしてください。
        </p>
        <button 
          onclick="window.location.reload()" 
          style="
            background: #007bff;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
            font-size: 1rem;
          "
        >
          再読み込み
        </button>
      </div>
    `
  }
}

// Start the application
initializeAndRender()