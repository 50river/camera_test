import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import App from '../../App'

describe('Final Integration Tests', () => {
  beforeEach(() => {
    // Clean up any previous state
    cleanup()
  })

  afterEach(() => {
    cleanup()
  })

  it('should render the complete application', async () => {
    render(<App />)
    
    // Check that the main app components are rendered
    expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    
    // Check navigation items
    expect(screen.getByText('テスト')).toBeInTheDocument()
    expect(screen.getByText('撮影')).toBeInTheDocument()
    expect(screen.getByText('データ管理')).toBeInTheDocument()
    
    // Check help button
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
  })

  it('should show service integration status', async () => {
    render(<App />)
    
    // Check for service integration indicators
    expect(screen.getByText('サービス層統合テスト')).toBeInTheDocument()
    expect(screen.getByText('サービス層とストレージの初期化が完了しました！')).toBeInTheDocument()
    
    // Check for integrated components list
    expect(screen.getByText('統合済みコンポーネント')).toBeInTheDocument()
    expect(screen.getByText('✅ NotificationCenter - 通知システム')).toBeInTheDocument()
    expect(screen.getByText('✅ ErrorBoundary - エラーハンドリング')).toBeInTheDocument()
    expect(screen.getByText('✅ OCREngine - PaddleOCR エンジン')).toBeInTheDocument()
  })

  it('should display service status information', async () => {
    render(<App />)
    
    // Check service status section
    expect(screen.getByText('サービス状態')).toBeInTheDocument()
    expect(screen.getByText('初期化済み:')).toBeInTheDocument()
    expect(screen.getByText('はい')).toBeInTheDocument()
    expect(screen.getByText('サービス数:')).toBeInTheDocument()
  })

  it('should show storage status', async () => {
    render(<App />)
    
    // Check storage status section
    expect(screen.getByText('ストレージ状態')).toBeInTheDocument()
    expect(screen.getByText('保存済み領収書:')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('件')).toBeInTheDocument()
  })

  it('should have functional test buttons', async () => {
    render(<App />)
    
    // Check for test buttons
    expect(screen.getByText('基本テスト')).toBeInTheDocument()
    expect(screen.getByText('通知システムテスト')).toBeInTheDocument()
    expect(screen.getByText('サービス層テスト')).toBeInTheDocument()
    expect(screen.getByText('設定システムテスト')).toBeInTheDocument()
    expect(screen.getByText('OCRエンジンテスト')).toBeInTheDocument()
    expect(screen.getByText('エラーテスト')).toBeInTheDocument()
  })

  it('should display notifications', async () => {
    render(<App />)
    
    // Check for notification system
    const notifications = document.querySelector('.notification-center')
    expect(notifications).toBeInTheDocument()
    
    // Check for startup notification
    expect(screen.getByText('アプリケーション開始')).toBeInTheDocument()
    expect(screen.getByText('領収書OCRアプリケーションが正常に起動しました（0件の領収書を読み込み）')).toBeInTheDocument()
  })

  it('should have proper CSS styling', async () => {
    render(<App />)
    
    // Check that main app container has proper class
    const appContainer = document.querySelector('.app')
    expect(appContainer).toBeInTheDocument()
    
    // Check header structure
    const header = document.querySelector('.app-header')
    expect(header).toBeInTheDocument()
    
    // Check main content area
    const main = document.querySelector('.app-main')
    expect(main).toBeInTheDocument()
  })

  it('should handle responsive design elements', async () => {
    render(<App />)
    
    // Check for responsive navigation
    const nav = document.querySelector('.main-nav')
    expect(nav).toBeInTheDocument()
    
    // Check for header actions
    const headerActions = document.querySelector('.header-actions')
    expect(headerActions).toBeInTheDocument()
  })
})