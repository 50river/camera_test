function App() {
  return (
    <div style={{
      padding: '2rem',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#333' }}>領収書OCR - 最小バージョン</h1>
      <p>このページが表示されていれば、Reactは正常に動作しています。</p>
      <button 
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
        onClick={() => alert('ボタンが動作しています！')}
      >
        テストボタン
      </button>
    </div>
  )
}

export default App