import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App-minimal.tsx'

console.log('main.tsx loading...')

const rootElement = document.getElementById('root')
if (rootElement) {
  console.log('Root element found, creating React root...')
  const root = ReactDOM.createRoot(rootElement)
  root.render(<App />)
  console.log('React app rendered')
} else {
  console.error('Root element not found!')
}