import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'

describe('Help System Integration Tests', () => {
  beforeEach(() => {
    // Clear any existing DOM
    document.body.innerHTML = ''
  })

  it('should render help button in header', async () => {
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Check if help button is present
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    expect(helpButton).toBeInTheDocument()
    expect(helpButton).toHaveTextContent('ヘルプ')
  })

  it('should open help system when help button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Click help button
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    await user.click(helpButton)

    // Check if help system is opened
    await waitFor(() => {
      expect(screen.getByText('ヘルプ・ガイドへようこそ')).toBeInTheDocument()
    })

    // Check if help categories are visible
    expect(screen.getByText('基本操作')).toBeInTheDocument()
    expect(screen.getByText('トラブルシューティング')).toBeInTheDocument()
    expect(screen.getByText('高度な機能')).toBeInTheDocument()
  })

  it('should close help system when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Open help system
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    await user.click(helpButton)

    await waitFor(() => {
      expect(screen.getByText('ヘルプ・ガイドへようこそ')).toBeInTheDocument()
    })

    // Close help system
    const closeButton = screen.getByLabelText('ヘルプを閉じる')
    await user.click(closeButton)

    // Check if help system is closed
    await waitFor(() => {
      expect(screen.queryByText('ヘルプ・ガイドへようこそ')).not.toBeInTheDocument()
    })
  })

  it('should navigate between help topics', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Open help system
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    await user.click(helpButton)

    await waitFor(() => {
      expect(screen.getByText('ヘルプ・ガイドへようこそ')).toBeInTheDocument()
    })

    // Click on a help topic
    const basicUsageTopic = screen.getByText('基本的な使い方')
    await user.click(basicUsageTopic)

    // Check if topic content is displayed
    await waitFor(() => {
      expect(screen.getByText('領収書OCRアプリの使い方')).toBeInTheDocument()
    })
  })

  it('should filter topics by category', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Open help system
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    await user.click(helpButton)

    await waitFor(() => {
      expect(screen.getByText('ヘルプ・ガイドへようこそ')).toBeInTheDocument()
    })

    // Click on troubleshooting category
    const troubleshootingCategory = screen.getByText('トラブルシューティング')
    await user.click(troubleshootingCategory)

    // Check if troubleshooting topics are visible
    await waitFor(() => {
      expect(screen.getByText('OCRが失敗する場合')).toBeInTheDocument()
      expect(screen.getByText('信頼度が低い結果')).toBeInTheDocument()
    })
  })

  it('should search help topics', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Wait for app to initialize
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })

    // Open help system
    const helpButton = screen.getByTitle('ヘルプ・ガイド')
    await user.click(helpButton)

    await waitFor(() => {
      expect(screen.getByText('ヘルプ・ガイドへようこそ')).toBeInTheDocument()
    })

    // Search for "撮影"
    const searchInput = screen.getByPlaceholderText('ヘルプを検索...')
    await user.type(searchInput, '撮影')

    // Check if camera-related topics are filtered
    await waitFor(() => {
      expect(screen.getByText('撮影のコツ')).toBeInTheDocument()
    })
  })
})