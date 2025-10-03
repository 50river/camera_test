import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../App'

// Mock the image processing components
vi.mock('../../components/CameraCapture', () => ({
  CameraCapture: ({ onImageCapture, onError }: any) => (
    <div data-testid="camera-capture">
      <button 
        onClick={() => {
          // Simulate image capture
          const mockImageData = new ImageData(100, 100)
          onImageCapture(mockImageData)
        }}
      >
        カメラで撮影
      </button>
      <button 
        onClick={() => {
          onError(new Error('Test error'))
        }}
      >
        エラーテスト
      </button>
    </div>
  )
}))

vi.mock('../../components/ImagePreview', () => ({
  ImagePreview: ({ imageData, onRegionSelect, onImageUpdate }: any) => (
    <div data-testid="image-preview">
      {imageData ? (
        <div>
          <div>画像サイズ: {imageData.width}x{imageData.height}</div>
          <button 
            onClick={() => {
              onRegionSelect({ x: 10, y: 10, width: 50, height: 20 })
            }}
          >
            領域選択
          </button>
          <button 
            onClick={() => {
              const newImageData = new ImageData(120, 120)
              onImageUpdate(newImageData)
            }}
          >
            透視補正
          </button>
        </div>
      ) : (
        <div>画像が選択されていません</div>
      )}
    </div>
  )
}))

describe('Image Processing Integration', () => {
  it('should integrate image processing components properly', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Switch to capture view
    const captureTab = screen.getByText('撮影')
    fireEvent.click(captureTab)
    
    // Verify camera capture component is rendered
    expect(screen.getByTestId('camera-capture')).toBeInTheDocument()
    expect(screen.getByTestId('image-preview')).toBeInTheDocument()
    
    // Verify initial state
    expect(screen.getByText('画像が選択されていません')).toBeInTheDocument()
  })

  it('should handle image capture workflow', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Switch to capture view
    const captureTab = screen.getByText('撮影')
    fireEvent.click(captureTab)
    
    // Simulate image capture
    const captureButton = screen.getByText('カメラで撮影')
    fireEvent.click(captureButton)
    
    // Verify image is displayed
    await waitFor(() => {
      expect(screen.getByText('画像サイズ: 100x100')).toBeInTheDocument()
    })
    
    // Verify processing step is shown
    expect(screen.getByText('画像が正常に読み込まれました')).toBeInTheDocument()
  })

  it('should handle region selection', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Switch to capture view and capture image
    const captureTab = screen.getByText('撮影')
    fireEvent.click(captureTab)
    
    const captureButton = screen.getByText('カメラで撮影')
    fireEvent.click(captureButton)
    
    // Wait for image to be processed
    await waitFor(() => {
      expect(screen.getByText('画像サイズ: 100x100')).toBeInTheDocument()
    })
    
    // Simulate region selection
    const regionButton = screen.getByText('領域選択')
    fireEvent.click(regionButton)
    
    // Verify OCR processing message appears
    await waitFor(() => {
      expect(screen.getByText(/選択領域でOCRを実行中/)).toBeInTheDocument()
    })
  })

  it('should handle image update from perspective correction', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Switch to capture view and capture image
    const captureTab = screen.getByText('撮影')
    fireEvent.click(captureTab)
    
    const captureButton = screen.getByText('カメラで撮影')
    fireEvent.click(captureButton)
    
    // Wait for image to be processed
    await waitFor(() => {
      expect(screen.getByText('画像サイズ: 100x100')).toBeInTheDocument()
    })
    
    // Simulate perspective correction
    const perspectiveButton = screen.getByText('透視補正')
    fireEvent.click(perspectiveButton)
    
    // Verify image is updated
    await waitFor(() => {
      expect(screen.getByText('画像サイズ: 120x120')).toBeInTheDocument()
    })
    
    // Verify processing step is updated
    expect(screen.getByText('画像が更新されました（透視補正適用済み）')).toBeInTheDocument()
  })

  it('should handle image processing errors', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Switch to capture view
    const captureTab = screen.getByText('撮影')
    fireEvent.click(captureTab)
    
    // Simulate error
    const errorButton = screen.getByText('エラーテスト')
    fireEvent.click(errorButton)
    
    // Verify error message is shown
    await waitFor(() => {
      expect(screen.getByText('エラー: Test error')).toBeInTheDocument()
    })
  })

  it('should show navigation between test and capture views', async () => {
    render(<App />)
    
    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByText('領収書OCR')).toBeInTheDocument()
    })
    
    // Verify test view is active by default
    const testTab = screen.getByText('テスト')
    const captureTab = screen.getByText('撮影')
    
    expect(testTab.closest('button')).toHaveClass('active')
    expect(captureTab.closest('button')).not.toHaveClass('active')
    
    // Switch to capture view
    fireEvent.click(captureTab)
    
    // Verify capture view is now active
    expect(testTab.closest('button')).not.toHaveClass('active')
    expect(captureTab.closest('button')).toHaveClass('active')
    
    // Verify capture components are shown
    expect(screen.getByTestId('camera-capture')).toBeInTheDocument()
    expect(screen.getByTestId('image-preview')).toBeInTheDocument()
    
    // Switch back to test view
    fireEvent.click(testTab)
    
    // Verify test view is active again
    expect(testTab.closest('button')).toHaveClass('active')
    expect(captureTab.closest('button')).not.toHaveClass('active')
    
    // Verify test content is shown
    expect(screen.getByText('サービス層統合テスト')).toBeInTheDocument()
  })
})