import React, { useState } from 'react'

interface HelpTopic {
  id: string
  title: string
  content: string
  category: 'basic' | 'troubleshooting' | 'advanced'
}

interface HelpSystemProps {
  isOpen: boolean
  onClose: () => void
}

const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: '基本的な使い方',
    category: 'basic',
    content: `
      <h3>領収書OCRアプリの使い方</h3>
      <ol>
        <li><strong>撮影</strong>: カメラボタンをタップして領収書を撮影するか、ファイルから選択します</li>
        <li><strong>自動処理</strong>: アプリが自動的に文字を認識し、データを抽出します</li>
        <li><strong>確認・修正</strong>: 抽出されたデータを確認し、必要に応じて修正します</li>
        <li><strong>保存</strong>: データを保存して履歴に追加します</li>
        <li><strong>エクスポート</strong>: JSONやCSV形式でデータをエクスポートできます</li>
      </ol>
    `
  },
  {
    id: 'camera-tips',
    title: '撮影のコツ',
    category: 'basic',
    content: `
      <h3>きれいに撮影するためのポイント</h3>
      <ul>
        <li><strong>明るい場所で撮影</strong>: 自然光の下や明るい照明の下で撮影してください</li>
        <li><strong>正面から撮影</strong>: 領収書に対して垂直に撮影してください</li>
        <li><strong>全体を写す</strong>: 領収書の四隅がすべて写るように撮影してください</li>
        <li><strong>手ブレを避ける</strong>: しっかりと手を固定して撮影してください</li>
        <li><strong>影を避ける</strong>: 影が文字にかからないように注意してください</li>
      </ul>
    `
  },
  {
    id: 'manual-selection',
    title: '手動領域選択',
    category: 'basic',
    content: `
      <h3>手動で領域を選択する方法</h3>
      <p>自動抽出がうまくいかない場合は、手動で領域を選択できます：</p>
      <ol>
        <li>画像プレビューで「領域選択」ボタンをタップ</li>
        <li>抽出したい部分をドラッグして選択</li>
        <li>選択範囲を調整</li>
        <li>「確定」ボタンで再OCRを実行</li>
      </ol>
      <p>この機能は、文字が小さい場合や複雑なレイアウトの領収書で特に有効です。</p>
    `
  },
  {
    id: 'ocr-failed',
    title: 'OCRが失敗する場合',
    category: 'troubleshooting',
    content: `
      <h3>文字認識がうまくいかない時の対処法</h3>
      <h4>画像の品質を改善する</h4>
      <ul>
        <li>より明るい場所で再撮影</li>
        <li>高解像度で撮影</li>
        <li>文字にピントを合わせる</li>
        <li>影や反射を避ける</li>
      </ul>
      <h4>手動領域選択を使用</h4>
      <ul>
        <li>認識したい部分だけを選択</li>
        <li>複数回に分けて選択</li>
      </ul>
      <h4>手動入力</h4>
      <ul>
        <li>最終手段として手動で入力</li>
        <li>部分的に認識された結果を修正</li>
      </ul>
    `
  },
  {
    id: 'low-confidence',
    title: '信頼度が低い結果',
    category: 'troubleshooting',
    content: `
      <h3>信頼度が低い場合の対処法</h3>
      <p>抽出結果に⚠️マークが表示される場合：</p>
      <ul>
        <li><strong>内容を確認</strong>: 抽出された内容が正しいか確認してください</li>
        <li><strong>候補から選択</strong>: ドロップダウンから他の候補を選択できます</li>
        <li><strong>手動修正</strong>: 直接入力フィールドを編集できます</li>
        <li><strong>再撮影</strong>: より良い条件で再撮影を試してください</li>
      </ul>
      <p>信頼度80%未満の結果には注意が必要です。</p>
    `
  },
  {
    id: 'browser-support',
    title: 'ブラウザの対応状況',
    category: 'troubleshooting',
    content: `
      <h3>対応ブラウザ</h3>
      <p>このアプリは以下のブラウザで動作します：</p>
      <ul>
        <li><strong>Chrome</strong> 88以降（推奨）</li>
        <li><strong>Firefox</strong> 85以降</li>
        <li><strong>Safari</strong> 14以降</li>
        <li><strong>Edge</strong> 88以降</li>
      </ul>
      <h4>必要な機能</h4>
      <ul>
        <li>WebAssembly (WASM)</li>
        <li>IndexedDB</li>
        <li>File API</li>
        <li>Camera API (カメラ使用時)</li>
      </ul>
    `
  },
  {
    id: 'data-privacy',
    title: 'データのプライバシー',
    category: 'advanced',
    content: `
      <h3>プライバシーとセキュリティ</h3>
      <p>このアプリはプライバシーを重視して設計されています：</p>
      <ul>
        <li><strong>完全ローカル処理</strong>: すべての処理がブラウザ内で完結</li>
        <li><strong>サーバー送信なし</strong>: 画像やデータは外部に送信されません</li>
        <li><strong>ローカル保存</strong>: データはお使いのデバイスにのみ保存</li>
        <li><strong>暗号化</strong>: ブラウザの標準的なセキュリティ機能を使用</li>
      </ul>
      <p>データを削除したい場合は、設定画面から「すべてのデータを削除」を実行してください。</p>
    `
  },
  {
    id: 'export-formats',
    title: 'エクスポート形式',
    category: 'advanced',
    content: `
      <h3>データのエクスポート</h3>
      <h4>JSON形式</h4>
      <ul>
        <li>完全なデータ構造を保持</li>
        <li>信頼度スコアや候補も含む</li>
        <li>プログラムでの処理に適している</li>
      </ul>
      <h4>CSV形式</h4>
      <ul>
        <li>表計算ソフトで開ける</li>
        <li>基本的なフィールドのみ</li>
        <li>会計ソフトへのインポートに適している</li>
      </ul>
      <p>エクスポートしたファイルは、お使いのデバイスのダウンロードフォルダに保存されます。</p>
    `
  }
]

export const HelpSystem: React.FC<HelpSystemProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('basic')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const categories = {
    basic: '基本操作',
    troubleshooting: 'トラブルシューティング',
    advanced: '高度な機能'
  }

  const filteredTopics = helpTopics.filter(topic => {
    const matchesCategory = selectedCategory === 'all' || topic.category === selectedCategory
    const matchesSearch = searchQuery === '' || 
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesCategory && matchesSearch
  })

  const selectedTopicData = selectedTopic ? 
    helpTopics.find(topic => topic.id === selectedTopic) : null

  if (!isOpen) return null

  return (
    <div className="help-system-overlay">
      <div className="help-system">
        <div className="help-header">
          <h2>ヘルプ・ガイド</h2>
          <button 
            className="help-close"
            onClick={onClose}
            aria-label="ヘルプを閉じる"
          >
            ×
          </button>
        </div>

        <div className="help-content">
          <div className="help-sidebar">
            <div className="help-search">
              <input
                type="text"
                placeholder="ヘルプを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="help-search-input"
              />
            </div>

            <div className="help-categories">
              <button
                className={`help-category ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                すべて
              </button>
              {Object.entries(categories).map(([key, label]) => (
                <button
                  key={key}
                  className={`help-category ${selectedCategory === key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="help-topics">
              {filteredTopics.map(topic => (
                <button
                  key={topic.id}
                  className={`help-topic ${selectedTopic === topic.id ? 'active' : ''}`}
                  onClick={() => setSelectedTopic(topic.id)}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </div>

          <div className="help-main">
            {selectedTopicData ? (
              <div className="help-article">
                <div 
                  className="help-article-content"
                  dangerouslySetInnerHTML={{ __html: selectedTopicData.content }}
                />
              </div>
            ) : (
              <div className="help-welcome">
                <h3>ヘルプ・ガイドへようこそ</h3>
                <p>左側のトピックから知りたい内容を選択してください。</p>
                <div className="help-quick-links">
                  <h4>よく見られるトピック</h4>
                  <button 
                    className="help-quick-link"
                    onClick={() => setSelectedTopic('getting-started')}
                  >
                    📖 基本的な使い方
                  </button>
                  <button 
                    className="help-quick-link"
                    onClick={() => setSelectedTopic('camera-tips')}
                  >
                    📷 撮影のコツ
                  </button>
                  <button 
                    className="help-quick-link"
                    onClick={() => setSelectedTopic('ocr-failed')}
                  >
                    🔧 OCRが失敗する場合
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for help system
export const useHelp = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  const openHelp = (topicId?: string) => {
    setIsHelpOpen(true)
    // If topicId is provided, you could set it as the selected topic
  }

  const closeHelp = () => {
    setIsHelpOpen(false)
  }

  return {
    isHelpOpen,
    openHelp,
    closeHelp
  }
}