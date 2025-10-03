import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Rectangle } from '../types'
import { PaddleOCREngine } from '../engines/OCREngine'

interface RegionSelectorProps {
  imageData: ImageData
  onRegionConfirm: (region: Rectangle, ocrResults?: OCRResult[]) => void
  onCancel: () => void
  initialRegion?: Rectangle
}

interface OCRResult {
  text: string
  confidence: number
  bbox: Rectangle
  candidates: string[]
}

interface SelectionState {
  isSelecting: boolean
  isDragging: boolean
  isResizing: boolean
  resizeHandle: string | null
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface ViewState {
  scale: number
  offsetX: number
  offsetY: number
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({ 
  imageData, 
  onRegionConfirm, 
  onCancel,
  initialRegion
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [selection, setSelection] = useState<SelectionState>({
    isSelecting: false,
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  })
  
  const [selectedRegion, setSelectedRegion] = useState<Rectangle | null>(
    initialRegion || null
  )
  
  const [viewState, setViewState] = useState<ViewState>({ 
    scale: 1, 
    offsetX: 0, 
    offsetY: 0 
  })
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [ocrEngine] = useState(() => new PaddleOCREngine())

  // Draw image and selection overlay
  const drawCanvas = useCallback(() => {
    if (!imageData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context for transformations
    ctx.save()

    // Apply zoom and pan transformations
    ctx.scale(viewState.scale, viewState.scale)
    ctx.translate(viewState.offsetX, viewState.offsetY)

    // Draw image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx) {
      tempCanvas.width = imageData.width
      tempCanvas.height = imageData.height
      tempCtx.putImageData(imageData, 0, 0)
      ctx.drawImage(tempCanvas, 0, 0)
    }

    // Restore context for overlay drawing
    ctx.restore()

    // Draw selection overlay
    if (selection.isSelecting) {
      const x = Math.min(selection.startX, selection.currentX)
      const y = Math.min(selection.startY, selection.currentY)
      const width = Math.abs(selection.currentX - selection.startX)
      const height = Math.abs(selection.currentY - selection.startY)

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 123, 255, 0.2)'
      ctx.fillRect(x, y, width, height)

      // Border
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)
    }

    // Draw selected region with resize handles
    if (selectedRegion) {
      const { x, y, width, height } = selectedRegion

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 123, 255, 0.2)'
      ctx.fillRect(x, y, width, height)

      // Border
      ctx.strokeStyle = '#007bff'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // Resize handles
      const handleSize = 8
      const handles = [
        { x: x - handleSize/2, y: y - handleSize/2, cursor: 'nw-resize', handle: 'nw' },
        { x: x + width/2 - handleSize/2, y: y - handleSize/2, cursor: 'n-resize', handle: 'n' },
        { x: x + width - handleSize/2, y: y - handleSize/2, cursor: 'ne-resize', handle: 'ne' },
        { x: x + width - handleSize/2, y: y + height/2 - handleSize/2, cursor: 'e-resize', handle: 'e' },
        { x: x + width - handleSize/2, y: y + height - handleSize/2, cursor: 'se-resize', handle: 'se' },
        { x: x + width/2 - handleSize/2, y: y + height - handleSize/2, cursor: 's-resize', handle: 's' },
        { x: x - handleSize/2, y: y + height - handleSize/2, cursor: 'sw-resize', handle: 'sw' },
        { x: x - handleSize/2, y: y + height/2 - handleSize/2, cursor: 'w-resize', handle: 'w' }
      ]

      handles.forEach(handle => {
        ctx.fillStyle = '#007bff'
        ctx.fillRect(handle.x, handle.y, handleSize, handleSize)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.strokeRect(handle.x, handle.y, handleSize, handleSize)
      })
    }
  }, [imageData, viewState, selection, selectedRegion])

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = imageData.width
      canvas.height = imageData.height
      
      // Reset view state when new image is loaded
      setViewState({ scale: 1, offsetX: 0, offsetY: 0 })
      
      drawCanvas()
    }
  }, [imageData, drawCanvas])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Convert screen coordinates to canvas coordinates
  const getCanvasCoordinates = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  // Check if point is on a resize handle
  const getResizeHandle = (x: number, y: number): string | null => {
    if (!selectedRegion) return null

    const { x: rx, y: ry, width, height } = selectedRegion
    const handleSize = 8
    const tolerance = 4

    const handles = [
      { x: rx - handleSize/2, y: ry - handleSize/2, handle: 'nw' },
      { x: rx + width/2 - handleSize/2, y: ry - handleSize/2, handle: 'n' },
      { x: rx + width - handleSize/2, y: ry - handleSize/2, handle: 'ne' },
      { x: rx + width - handleSize/2, y: ry + height/2 - handleSize/2, handle: 'e' },
      { x: rx + width - handleSize/2, y: ry + height - handleSize/2, handle: 'se' },
      { x: rx + width/2 - handleSize/2, y: ry + height - handleSize/2, handle: 's' },
      { x: rx - handleSize/2, y: ry + height - handleSize/2, handle: 'sw' },
      { x: rx - handleSize/2, y: ry + height/2 - handleSize/2, handle: 'w' }
    ]

    for (const handle of handles) {
      if (x >= handle.x - tolerance && x <= handle.x + handleSize + tolerance &&
          y >= handle.y - tolerance && y <= handle.y + handleSize + tolerance) {
        return handle.handle
      }
    }

    return null
  }

  // Check if point is inside selected region
  const isInsideRegion = (x: number, y: number): boolean => {
    if (!selectedRegion) return false
    const { x: rx, y: ry, width, height } = selectedRegion
    return x >= rx && x <= rx + width && y >= ry && y <= ry + height
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY)
    const resizeHandle = getResizeHandle(coords.x, coords.y)

    if (resizeHandle) {
      // Start resizing
      setSelection(prev => ({
        ...prev,
        isResizing: true,
        resizeHandle,
        startX: coords.x,
        startY: coords.y
      }))
    } else if (selectedRegion && isInsideRegion(coords.x, coords.y)) {
      // Start dragging
      setSelection(prev => ({
        ...prev,
        isDragging: true,
        startX: coords.x,
        startY: coords.y
      }))
    } else {
      // Start new selection
      setSelectedRegion(null)
      setSelection({
        isSelecting: true,
        isDragging: false,
        isResizing: false,
        resizeHandle: null,
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY)

    if (selection.isSelecting) {
      setSelection(prev => ({
        ...prev,
        currentX: coords.x,
        currentY: coords.y
      }))
    } else if (selection.isDragging && selectedRegion) {
      const deltaX = coords.x - selection.startX
      const deltaY = coords.y - selection.startY
      
      setSelectedRegion(prev => prev ? ({
        ...prev,
        x: Math.max(0, Math.min(imageData.width - prev.width, prev.x + deltaX)),
        y: Math.max(0, Math.min(imageData.height - prev.height, prev.y + deltaY))
      }) : null)
      
      setSelection(prev => ({
        ...prev,
        startX: coords.x,
        startY: coords.y
      }))
    } else if (selection.isResizing && selectedRegion && selection.resizeHandle) {
      const deltaX = coords.x - selection.startX
      const deltaY = coords.y - selection.startY
      
      let newRegion = { ...selectedRegion }
      
      switch (selection.resizeHandle) {
        case 'nw':
          newRegion.x += deltaX
          newRegion.y += deltaY
          newRegion.width -= deltaX
          newRegion.height -= deltaY
          break
        case 'n':
          newRegion.y += deltaY
          newRegion.height -= deltaY
          break
        case 'ne':
          newRegion.y += deltaY
          newRegion.width += deltaX
          newRegion.height -= deltaY
          break
        case 'e':
          newRegion.width += deltaX
          break
        case 'se':
          newRegion.width += deltaX
          newRegion.height += deltaY
          break
        case 's':
          newRegion.height += deltaY
          break
        case 'sw':
          newRegion.x += deltaX
          newRegion.width -= deltaX
          newRegion.height += deltaY
          break
        case 'w':
          newRegion.x += deltaX
          newRegion.width -= deltaX
          break
      }
      
      // Ensure minimum size and bounds
      newRegion.width = Math.max(10, newRegion.width)
      newRegion.height = Math.max(10, newRegion.height)
      newRegion.x = Math.max(0, Math.min(imageData.width - newRegion.width, newRegion.x))
      newRegion.y = Math.max(0, Math.min(imageData.height - newRegion.height, newRegion.y))
      
      setSelectedRegion(newRegion)
      setSelection(prev => ({
        ...prev,
        startX: coords.x,
        startY: coords.y
      }))
    }

    // Update cursor
    if (canvasRef.current) {
      const resizeHandle = getResizeHandle(coords.x, coords.y)
      if (resizeHandle) {
        const cursors: { [key: string]: string } = {
          'nw': 'nw-resize', 'n': 'n-resize', 'ne': 'ne-resize',
          'e': 'e-resize', 'se': 'se-resize', 's': 's-resize',
          'sw': 'sw-resize', 'w': 'w-resize'
        }
        canvasRef.current.style.cursor = cursors[resizeHandle]
      } else if (selectedRegion && isInsideRegion(coords.x, coords.y)) {
        canvasRef.current.style.cursor = 'move'
      } else {
        canvasRef.current.style.cursor = 'crosshair'
      }
    }
  }

  const handleMouseUp = () => {
    if (selection.isSelecting) {
      const x = Math.min(selection.startX, selection.currentX)
      const y = Math.min(selection.startY, selection.currentY)
      const width = Math.abs(selection.currentX - selection.startX)
      const height = Math.abs(selection.currentY - selection.startY)
      
      if (width > 10 && height > 10) { // Minimum selection size
        setSelectedRegion({ x, y, width, height })
      }
    }
    
    setSelection({
      isSelecting: false,
      isDragging: false,
      isResizing: false,
      resizeHandle: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0
    })
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    handleMouseUp()
  }

  // Zoom handlers
  const handleZoomIn = () => {
    setViewState(prev => ({
      ...prev,
      scale: Math.min(5, prev.scale * 1.2)
    }))
  }

  const handleZoomOut = () => {
    setViewState(prev => ({
      ...prev,
      scale: Math.max(0.1, prev.scale / 1.2)
    }))
  }

  const handleResetView = () => {
    setViewState({ scale: 1, offsetX: 0, offsetY: 0 })
  }

  const handleConfirm = async () => {
    if (!selectedRegion) return

    setIsProcessing(true)
    setProcessingStatus('OCRエンジンを初期化中...')

    try {
      // Initialize OCR engine if not already initialized
      if (!ocrEngine.isInitialized()) {
        await ocrEngine.initialize()
      }

      setProcessingStatus('選択領域をOCR処理中...')

      // Process the selected region with OCR
      const ocrResults = await ocrEngine.processRegion(imageData, selectedRegion)

      setProcessingStatus('処理完了')

      // Call the callback with both region and OCR results
      onRegionConfirm(selectedRegion, ocrResults)
    } catch (error) {
      console.error('Region OCR failed:', error)
      setProcessingStatus('OCR処理に失敗しました')
      
      // Still call the callback with just the region
      setTimeout(() => {
        onRegionConfirm(selectedRegion)
      }, 1500)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="region-selector">
      <div className="selector-header">
        <h3>領域を選択</h3>
        <div className="zoom-info">
          {Math.round(viewState.scale * 100)}%
        </div>
      </div>
      
      <div className="selector-container">
        <div 
          ref={containerRef}
          className="canvas-container"
          style={{ overflow: 'hidden' }}
        >
          <canvas
            ref={canvasRef}
            className="selector-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              border: '1px solid #ddd',
              borderRadius: '0.5rem',
              touchAction: 'none',
              cursor: 'crosshair'
            }}
          />
        </div>
        
        <div className="selector-controls">
          <div className="control-group">
            <button 
              onClick={handleZoomIn}
              className="control-button"
              title="ズームイン"
            >
              🔍+
            </button>
            <button 
              onClick={handleZoomOut}
              className="control-button"
              title="ズームアウト"
            >
              🔍-
            </button>
            <button 
              onClick={handleResetView}
              className="control-button"
              title="表示リセット"
            >
              🔄
            </button>
          </div>
        </div>
        
        {isProcessing ? (
          <div className="processing-indicator">
            <div className="processing-spinner"></div>
            {processingStatus}
          </div>
        ) : (
          <div className="selection-hint">
            {selectedRegion 
              ? 'ハンドルをドラッグしてサイズ変更、領域内をドラッグして移動'
              : '画像上をドラッグして領域を選択してください'
            }
          </div>
        )}
      </div>
      
      <div className="selector-actions">
        <button 
          onClick={onCancel}
          className="cancel-button"
        >
          キャンセル
        </button>
        <button 
          onClick={handleConfirm}
          className="confirm-button"
          disabled={!selectedRegion || isProcessing}
        >
          {isProcessing ? '処理中...' : 'この領域でOCR実行'}
        </button>
      </div>
    </div>
  )
}