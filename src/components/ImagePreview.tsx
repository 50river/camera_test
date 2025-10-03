import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Rectangle, PerspectiveParams } from '../types'
import { PerspectiveCorrector } from './PerspectiveCorrector'
import { RegionSelector } from './RegionSelector'
import { ImageCaptureModuleImpl } from '../engines/ImageCaptureModule'

interface ImagePreviewProps {
  imageData: ImageData | null
  onRegionSelect: (region: Rectangle, ocrResults?: any[]) => void
  onImageUpdate?: (imageData: ImageData) => void
}

interface ViewState {
  scale: number
  offsetX: number
  offsetY: number
}

interface SelectionState {
  isSelecting: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ 
  imageData, 
  onRegionSelect,
  onImageUpdate 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showPerspectiveCorrector, setShowPerspectiveCorrector] = useState(false)
  const [showRegionSelector, setShowRegionSelector] = useState(false)
  const [perspectiveParams, setPerspectiveParams] = useState<PerspectiveParams | null>(null)
  const [viewState, setViewState] = useState<ViewState>({ scale: 1, offsetX: 0, offsetY: 0 })
  const [selection, setSelection] = useState<SelectionState>({ 
    isSelecting: false, 
    startX: 0, 
    startY: 0, 
    currentX: 0, 
    currentY: 0 
  })
  const [isRegionSelectMode, setIsRegionSelectMode] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const imageCaptureModule = new ImageCaptureModuleImpl()

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

    // Restore context
    ctx.restore()

    // Draw selection rectangle if selecting
    if (selection.isSelecting && isRegionSelectMode) {
      ctx.strokeStyle = '#007bff'
      ctx.fillStyle = 'rgba(0, 123, 255, 0.2)'
      ctx.lineWidth = 2

      const x = Math.min(selection.startX, selection.currentX)
      const y = Math.min(selection.startY, selection.currentY)
      const width = Math.abs(selection.currentX - selection.startX)
      const height = Math.abs(selection.currentY - selection.startY)

      ctx.fillRect(x, y, width, height)
      ctx.strokeRect(x, y, width, height)
    }
  }, [imageData, viewState, selection, isRegionSelectMode])

  useEffect(() => {
    if (imageData && canvasRef.current) {
      const canvas = canvasRef.current
      canvas.width = imageData.width
      canvas.height = imageData.height
      
      // Reset view state when new image is loaded
      setViewState({ scale: 1, offsetX: 0, offsetY: 0 })
      
      // Estimate perspective correction parameters
      const params = imageCaptureModule.estimatePerspectiveCorrection(imageData)
      setPerspectiveParams(params)
      
      drawCanvas()
    }
  }, [imageData, imageCaptureModule, drawCanvas])

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

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e.clientX, e.clientY)
    
    if (isRegionSelectMode) {
      setSelection({
        isSelecting: true,
        startX: coords.x,
        startY: coords.y,
        currentX: coords.x,
        currentY: coords.y
      })
    } else {
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isRegionSelectMode && selection.isSelecting) {
      const coords = getCanvasCoordinates(e.clientX, e.clientY)
      setSelection(prev => ({
        ...prev,
        currentX: coords.x,
        currentY: coords.y
      }))
    } else if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x
      const deltaY = e.clientY - lastPanPoint.y
      
      setViewState(prev => ({
        ...prev,
        offsetX: prev.offsetX + deltaX / prev.scale,
        offsetY: prev.offsetY + deltaY / prev.scale
      }))
      
      setLastPanPoint({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    if (isRegionSelectMode && selection.isSelecting) {
      const x = Math.min(selection.startX, selection.currentX)
      const y = Math.min(selection.startY, selection.currentY)
      const width = Math.abs(selection.currentX - selection.startX)
      const height = Math.abs(selection.currentY - selection.startY)
      
      if (width > 10 && height > 10) { // Minimum selection size
        onRegionSelect({ x, y, width, height })
      }
      
      setSelection({ isSelecting: false, startX: 0, startY: 0, currentX: 0, currentY: 0 })
      setIsRegionSelectMode(false)
    }
    
    setIsPanning(false)
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
      
      if (isRegionSelectMode) {
        setSelection({
          isSelecting: true,
          startX: coords.x,
          startY: coords.y,
          currentX: coords.x,
          currentY: coords.y
        })
      } else {
        setIsPanning(true)
        setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      
      if (isRegionSelectMode && selection.isSelecting) {
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY)
        setSelection(prev => ({
          ...prev,
          currentX: coords.x,
          currentY: coords.y
        }))
      } else if (isPanning) {
        const deltaX = touch.clientX - lastPanPoint.x
        const deltaY = touch.clientY - lastPanPoint.y
        
        setViewState(prev => ({
          ...prev,
          offsetX: prev.offsetX + deltaX / prev.scale,
          offsetY: prev.offsetY + deltaY / prev.scale
        }))
        
        setLastPanPoint({ x: touch.clientX, y: touch.clientY })
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    handleMouseUp()
  }

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = Math.max(0.1, Math.min(5, viewState.scale * delta))
    
    setViewState(prev => ({
      ...prev,
      scale: newScale
    }))
  }

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

  const handlePerspectiveCorrection = () => {
    if (imageData && perspectiveParams) {
      setShowPerspectiveCorrector(true)
    }
  }

  const handlePerspectiveCorrectionConfirm = async (params: PerspectiveParams) => {
    if (imageData && onImageUpdate) {
      const correctedImage = await imageCaptureModule.applyPerspectiveCorrection(imageData, params)
      onImageUpdate(correctedImage)
    }
    setShowPerspectiveCorrector(false)
  }

  const handlePerspectiveCorrectionCancel = () => {
    setShowPerspectiveCorrector(false)
  }

  return (
    <div className="image-preview">
      <div className="preview-header">
        <h3>画像プレビュー</h3>
        {imageData && (
          <div className="zoom-info">
            {Math.round(viewState.scale * 100)}%
          </div>
        )}
      </div>
      
      {imageData ? (
        <div className="preview-container">
          <div 
            ref={containerRef}
            className="canvas-container"
            style={{ 
              overflow: 'hidden',
              cursor: isRegionSelectMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab'
            }}
          >
            <canvas
              ref={canvasRef}
              className="preview-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              style={{ 
                maxWidth: '100%', 
                height: 'auto',
                border: '1px solid #ddd',
                borderRadius: '0.5rem',
                touchAction: 'none'
              }}
            />
          </div>
          
          <div className="preview-controls">
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
            
            <div className="control-group">
              <button 
                onClick={() => setIsRegionSelectMode(!isRegionSelectMode)}
                className={`control-button ${isRegionSelectMode ? 'active' : ''}`}
                title="簡易領域選択"
              >
                {isRegionSelectMode ? '✅ 選択中' : '📐 簡易選択'}
              </button>
              <button 
                onClick={() => setShowRegionSelector(true)}
                className="control-button"
                title="詳細領域選択"
              >
                🎯 詳細選択
              </button>
              <button 
                onClick={handlePerspectiveCorrection}
                className="control-button"
                title="透視補正"
              >
                📐 透視補正
              </button>
            </div>
          </div>
          
          {isRegionSelectMode && (
            <div className="selection-hint">
              画像上をドラッグして領域を選択してください
            </div>
          )}
        </div>
      ) : (
        <div className="placeholder">
          <div className="placeholder-icon">📷</div>
          <p>画像が選択されていません</p>
          <p className="placeholder-hint">カメラで撮影するか、ファイルを選択してください</p>
        </div>
      )}

      {showPerspectiveCorrector && imageData && perspectiveParams && (
        <PerspectiveCorrector
          imageData={imageData}
          initialParams={perspectiveParams}
          onConfirm={handlePerspectiveCorrectionConfirm}
          onCancel={handlePerspectiveCorrectionCancel}
        />
      )}

      {showRegionSelector && imageData && (
        <RegionSelector
          imageData={imageData}
          onRegionConfirm={(region, ocrResults) => {
            onRegionSelect(region, ocrResults)
            setShowRegionSelector(false)
          }}
          onCancel={() => setShowRegionSelector(false)}
        />
      )}
    </div>
  )
}