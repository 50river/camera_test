import React, { useRef, useEffect, useState, useCallback } from 'react'
import { PerspectiveParams } from '../types'

interface PerspectiveCorrectorProps {
  imageData: ImageData
  initialParams: PerspectiveParams
  onConfirm: (params: PerspectiveParams) => void
  onCancel: () => void
}

export const PerspectiveCorrector: React.FC<PerspectiveCorrectorProps> = ({
  imageData,
  initialParams,
  onConfirm,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [corners, setCorners] = useState(initialParams.corners)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [scale, setScale] = useState(1)

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw the image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    tempCanvas.width = imageData.width
    tempCanvas.height = imageData.height
    tempCtx.putImageData(imageData, 0, 0)

    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)

    // Draw overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw the quadrilateral
    ctx.beginPath()
    ctx.moveTo(corners[0].x * scale, corners[0].y * scale)
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x * scale, corners[i].y * scale)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.fill()
    ctx.strokeStyle = '#007bff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw corner handles
    corners.forEach((corner, index) => {
      ctx.beginPath()
      ctx.arc(corner.x * scale, corner.y * scale, 8, 0, 2 * Math.PI)
      ctx.fillStyle = dragIndex === index ? '#ff4444' : '#007bff'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [imageData, corners, scale, dragIndex])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Calculate scale to fit image in canvas
    const maxWidth = Math.min(window.innerWidth * 0.9, 800)
    const maxHeight = Math.min(window.innerHeight * 0.7, 600)
    
    const scaleX = maxWidth / imageData.width
    const scaleY = maxHeight / imageData.height
    const newScale = Math.min(scaleX, scaleY)
    
    canvas.width = imageData.width * newScale
    canvas.height = imageData.height * newScale
    
    setScale(newScale)
  }, [imageData])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    }
  }

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || e.touches.length === 0) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    return {
      x: (touch.clientX - rect.left) / scale,
      y: (touch.clientY - rect.top) / scale
    }
  }

  const findNearestCorner = (pos: { x: number; y: number }) => {
    const threshold = 20 / scale // 20 pixels in original image coordinates
    let nearestIndex = -1
    let nearestDistance = Infinity

    corners.forEach((corner, index) => {
      const distance = Math.sqrt((corner.x - pos.x) ** 2 + (corner.y - pos.y) ** 2)
      if (distance < threshold && distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return nearestIndex >= 0 ? nearestIndex : null
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    const cornerIndex = findNearestCorner(pos)
    setDragIndex(cornerIndex)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragIndex === null) return

    const pos = getMousePos(e)
    const newCorners = [...corners]
    newCorners[dragIndex] = {
      x: Math.max(0, Math.min(imageData.width, pos.x)),
      y: Math.max(0, Math.min(imageData.height, pos.y))
    }
    setCorners(newCorners)
  }

  const handleMouseUp = () => {
    setDragIndex(null)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getTouchPos(e)
    const cornerIndex = findNearestCorner(pos)
    setDragIndex(cornerIndex)
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (dragIndex === null) return

    const pos = getTouchPos(e)
    const newCorners = [...corners]
    newCorners[dragIndex] = {
      x: Math.max(0, Math.min(imageData.width, pos.x)),
      y: Math.max(0, Math.min(imageData.height, pos.y))
    }
    setCorners(newCorners)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setDragIndex(null)
  }

  const handleConfirm = () => {
    const params: PerspectiveParams = {
      corners,
      transformMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] // Will be calculated in the engine
    }
    onConfirm(params)
  }

  const handleReset = () => {
    setCorners(initialParams.corners)
  }

  return (
    <div className="perspective-corrector">
      <div className="corrector-header">
        <h3>透視補正</h3>
        <p>四隅の青い点をドラッグして文書の境界を調整してください</p>
      </div>
      
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: dragIndex !== null ? 'grabbing' : 'grab' }}
        />
      </div>

      <div className="corrector-controls">
        <button onClick={onCancel} className="cancel-button">
          キャンセル
        </button>
        <button onClick={handleReset} className="reset-button">
          リセット
        </button>
        <button onClick={handleConfirm} className="confirm-button">
          適用
        </button>
      </div>
    </div>
  )
}