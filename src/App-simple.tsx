import { useState } from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('アプリケーションが正常に動作しています！')

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">領収書OCR</h1>
        </div>
      </header>

      <main className="app-main">
        <div className="view-content">
          <section className="capture-section">
            <h2>テスト画面</h2>
            <p>{message}</p>
            <button 
              className="primary-button"
              onClick={() => setMessage('ボタンが正常に動作しています！')}
            >
              テストボタン
            </button>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App