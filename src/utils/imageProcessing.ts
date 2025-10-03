import { Point, Rectangle } from '../types'

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = createCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function cropImageData(imageData: ImageData, region: Rectangle): ImageData {
  const canvas = imageDataToCanvas(imageData)
  const croppedCanvas = createCanvas(region.width, region.height)
  const ctx = croppedCanvas.getContext('2d')!
  
  ctx.drawImage(
    canvas,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  )
  
  return canvasToImageData(croppedCanvas)
}

export function resizeImageData(imageData: ImageData, maxWidth: number, maxHeight: number): ImageData {
  const canvas = imageDataToCanvas(imageData)
  const { width, height } = canvas
  
  // Calculate new dimensions maintaining aspect ratio
  const ratio = Math.min(maxWidth / width, maxHeight / height)
  const newWidth = Math.floor(width * ratio)
  const newHeight = Math.floor(height * ratio)
  
  const resizedCanvas = createCanvas(newWidth, newHeight)
  const ctx = resizedCanvas.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight)
  
  return canvasToImageData(resizedCanvas)
}

export function calculateDistance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}