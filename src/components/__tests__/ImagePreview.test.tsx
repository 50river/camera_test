import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImagePreview } from '../ImagePreview'
import { Rectangle } from '../../types'

// Mock the ImageCaptureModule
vi.mock('../../engines/ImageCaptureModule', () => ({
  ImageCaptureModuleImpl: vi.fn().mockImplementation(() => ({
    estimatePerspectiveCorrection: vi.fn().mockReturnValue({
      corners: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      transformMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
    }),
    applyPerspectiveCorrection: vi.fn().mockResolvedValue(new ImageData(100, 100))
  }))
}))

// Mock the child components
vi.mock('../PerspectiveCorrector', () => ({
  PerspectiveCorrector: ({ onConfirm, onCancel }: any) => (
    <div data-testid="perspective-corrector">
      <button onClick={() => onConfirm({ corners: [], transformMatrix: [] })}>
        Confirm Correction
      </button>
      <button onClick={onCancel}>Cancel Correction</button>
    </div>
  )
}))

vi.mock('../RegionSelector', () => ({
  RegionSelector: ({ onRegionConfirm, onCancel }: any) => (
    <div data-testid="region-selector">
      <button onClick={() => onRegionConfirm({ x: 10, y: 10, width: 50, height: 50 }, [])}>
        Confirm Region
      </button>
      <button onClick={onCancel}>Cancel Region</button>
    </div>
  )
}))

describe('ImagePreview', () => {
  const mockOnRegionSelect = vi.fn()
  const mockOnImageUpdate = vi.fn()

  const mockImageData = new ImageData(200, 150)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render placeholder when no image data', () => {
    render(
      <ImagePreview
        imageData={null}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    expect(screen.getByText('画像が選択されていません')).toBeInTheDocument()
    expect(screen.getByText('カメラで撮影するか、ファイルを選択してください')).toBeInTheDocument()
  })

  it('should render canvas when image data is provided', () => {
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    expect(screen.getByText('画像プレビュー')).toBeInTheDocument()
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument() // Canvas element
  })

  it('should display zoom percentage', () => {
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('should render control buttons', () => {
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    expect(screen.getByTitle('ズームイン')).toBeInTheDocument()
    expect(screen.getByTitle('ズームアウト')).toBeInTheDocument()
    expect(screen.getByTitle('表示リセット')).toBeInTheDocument()
    expect(screen.getByTitle('簡易領域選択')).toBeInTheDocument()
    expect(screen.getByTitle('詳細領域選択')).toBeInTheDocument()
    expect(screen.getByTitle('透視補正')).toBeInTheDocument()
  })

  it('should handle zoom in button click', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const zoomInButton = screen.getByTitle('ズームイン')
    await user.click(zoomInButton)

    expect(screen.getByText('120%')).toBeInTheDocument()
  })

  it('should handle zoom out button click', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const zoomOutButton = screen.getByTitle('ズームアウト')
    await user.click(zoomOutButton)

    // Should be approximately 83% (100 / 1.2)
    expect(screen.getByText('83%')).toBeInTheDocument()
  })

  it('should handle reset view button click', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // First zoom in
    const zoomInButton = screen.getByTitle('ズームイン')
    await user.click(zoomInButton)

    // Then reset
    const resetButton = screen.getByTitle('表示リセット')
    await user.click(resetButton)

    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('should toggle region selection mode', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const regionSelectButton = screen.getByTitle('簡易領域選択')
    expect(regionSelectButton).toHaveTextContent('📐 簡易選択')

    await user.click(regionSelectButton)

    expect(regionSelectButton).toHaveTextContent('✅ 選択中')
    expect(screen.getByText('画像上をドラッグして領域を選択してください')).toBeInTheDocument()
  })

  it('should open detailed region selector', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const detailedSelectButton = screen.getByTitle('詳細領域選択')
    await user.click(detailedSelectButton)

    expect(screen.getByTestId('region-selector')).toBeInTheDocument()
  })

  it('should handle region selector confirmation', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // Open region selector
    const detailedSelectButton = screen.getByTitle('詳細領域選択')
    await user.click(detailedSelectButton)

    // Confirm region
    const confirmButton = screen.getByText('Confirm Region')
    await user.click(confirmButton)

    expect(mockOnRegionSelect).toHaveBeenCalledWith(
      { x: 10, y: 10, width: 50, height: 50 },
      []
    )
    expect(screen.queryByTestId('region-selector')).not.toBeInTheDocument()
  })

  it('should handle region selector cancellation', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // Open region selector
    const detailedSelectButton = screen.getByTitle('詳細領域選択')
    await user.click(detailedSelectButton)

    // Cancel region selection
    const cancelButton = screen.getByText('Cancel Region')
    await user.click(cancelButton)

    expect(mockOnRegionSelect).not.toHaveBeenCalled()
    expect(screen.queryByTestId('region-selector')).not.toBeInTheDocument()
  })

  it('should open perspective corrector', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const perspectiveButton = screen.getByTitle('透視補正')
    await user.click(perspectiveButton)

    expect(screen.getByTestId('perspective-corrector')).toBeInTheDocument()
  })

  it('should handle perspective correction confirmation', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // Open perspective corrector
    const perspectiveButton = screen.getByTitle('透視補正')
    await user.click(perspectiveButton)

    // Confirm correction
    const confirmButton = screen.getByText('Confirm Correction')
    await user.click(confirmButton)

    expect(mockOnImageUpdate).toHaveBeenCalledWith(expect.any(ImageData))
    expect(screen.queryByTestId('perspective-corrector')).not.toBeInTheDocument()
  })

  it('should handle perspective correction cancellation', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // Open perspective corrector
    const perspectiveButton = screen.getByTitle('透視補正')
    await user.click(perspectiveButton)

    // Cancel correction
    const cancelButton = screen.getByText('Cancel Correction')
    await user.click(cancelButton)

    expect(mockOnImageUpdate).not.toHaveBeenCalled()
    expect(screen.queryByTestId('perspective-corrector')).not.toBeInTheDocument()
  })

  it('should handle mouse wheel zoom', () => {
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    const canvas = screen.getByRole('img', { hidden: true })
    
    // Zoom in with wheel
    fireEvent.wheel(canvas, { deltaY: -100 })
    expect(screen.getByText('110%')).toBeInTheDocument()

    // Zoom out with wheel
    fireEvent.wheel(canvas, { deltaY: 100 })
    expect(screen.getByText('99%')).toBeInTheDocument()
  })

  it('should handle mouse selection in region select mode', async () => {
    const user = userEvent.setup()
    
    render(
      <ImagePreview
        imageData={mockImageData}
        onRegionSelect={mockOnRegionSelect}
        onImageUpdate={mockOnImageUpdate}
      />
    )

    // Enable region selection mode
    const regionSelectButton = screen.getByTitle('簡易領域選択')
    await user.click(regionSelectButton)

    const canvas = screen.getByRole('img', { hidden: true })

    // Simulate mouse selection
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(canvas, { clientX: 60, clientY: 60 })
    fireEvent.mouseUp(canvas)

    expect(mockOnRegionSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number)
      })
    )
  })
})