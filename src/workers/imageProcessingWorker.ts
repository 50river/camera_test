// WebWorker for heavy image processing operations
// This runs in a separate thread to avoid blocking the main UI thread

interface ImageProcessingMessage {
  type: 'resize' | 'crop' | 'perspective' | 'preprocess'
  id: string
  data: any
}

interface ImageProcessingResponse {
  type: 'success' | 'error'
  id: string
  data?: any
  error?: string
}

// Handle messages from main thread
self.onmessage = function(e: MessageEvent<ImageProcessingMessage>) {
  const { type, id, data } = e.data
  
  try {
    switch (type) {
      case 'resize':
        handleResize(id, data)
        break
      case 'crop':
        handleCrop(id, data)
        break
      case 'perspective':
        handlePerspectiveCorrection(id, data)
        break
      case 'preprocess':
        handlePreprocessing(id, data)
        break
      default:
        throw new Error(`Unknown operation type: ${type}`)
    }
  } catch (error) {
    postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    } as ImageProcessingResponse)
  }
}

function handleResize(id: string, data: { imageData: ImageData, maxWidth: number, maxHeight: number }) {
  const { imageData, maxWidth, maxHeight } = data
  
  // Create OffscreenCanvas for processing
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  
  // Calculate new dimensions maintaining aspect ratio
  const ratio = Math.min(maxWidth / imageData.width, maxHeight / imageData.height)
  const newWidth = Math.floor(imageData.width * ratio)
  const newHeight = Math.floor(imageData.height * ratio)
  
  // Create resized canvas
  const resizedCanvas = new OffscreenCanvas(newWidth, newHeight)
  const resizedCtx = resizedCanvas.getContext('2d')!
  
  // Use high-quality image scaling
  resizedCtx.imageSmoothingEnabled = true
  resizedCtx.imageSmoothingQuality = 'high'
  
  resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight)
  
  const resizedImageData = resizedCtx.getImageData(0, 0, newWidth, newHeight)
  
  postMessage({
    type: 'success',
    id,
    data: {
      imageData: resizedImageData,
      width: newWidth,
      height: newHeight
    }
  } as ImageProcessingResponse)
}

function handleCrop(id: string, data: { imageData: ImageData, region: { x: number, y: number, width: number, height: number } }) {
  const { imageData, region } = data
  
  // Create canvas with original image
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  
  // Create cropped canvas
  const croppedCanvas = new OffscreenCanvas(region.width, region.height)
  const croppedCtx = croppedCanvas.getContext('2d')!
  
  croppedCtx.drawImage(
    canvas,
    region.x, region.y, region.width, region.height,
    0, 0, region.width, region.height
  )
  
  const croppedImageData = croppedCtx.getImageData(0, 0, region.width, region.height)
  
  postMessage({
    type: 'success',
    id,
    data: { imageData: croppedImageData }
  } as ImageProcessingResponse)
}

function handlePerspectiveCorrection(id: string, data: { 
  imageData: ImageData, 
  corners: { x: number, y: number }[] 
}) {
  const { imageData, corners } = data
  
  // Calculate target dimensions
  const targetWidth = Math.max(
    distance(corners[0], corners[1]),
    distance(corners[3], corners[2])
  )
  const targetHeight = Math.max(
    distance(corners[0], corners[3]),
    distance(corners[1], corners[2])
  )
  
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  
  const correctedCanvas = new OffscreenCanvas(Math.round(targetWidth), Math.round(targetHeight))
  const correctedCtx = correctedCanvas.getContext('2d')!
  
  // Apply perspective transformation using bilinear interpolation
  const correctedImageData = correctedCtx.createImageData(correctedCanvas.width, correctedCanvas.height)
  const sourceImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  
  performPerspectiveTransform(
    sourceImageData,
    correctedImageData,
    corners,
    correctedCanvas.width,
    correctedCanvas.height
  )
  
  correctedCtx.putImageData(correctedImageData, 0, 0)
  
  postMessage({
    type: 'success',
    id,
    data: { imageData: correctedImageData }
  } as ImageProcessingResponse)
}

function handlePreprocessing(id: string, data: { 
  imageData: ImageData, 
  targetWidth: number, 
  targetHeight: number,
  normalize: boolean 
}) {
  const { imageData, targetWidth, targetHeight, normalize } = data
  
  // Resize image
  const canvas = new OffscreenCanvas(imageData.width, imageData.height)
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  
  const resizedCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const resizedCtx = resizedCanvas.getContext('2d')!
  
  resizedCtx.imageSmoothingEnabled = true
  resizedCtx.imageSmoothingQuality = 'high'
  resizedCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
  
  const resizedImageData = resizedCtx.getImageData(0, 0, targetWidth, targetHeight)
  
  let processedData = resizedImageData
  
  if (normalize) {
    // Convert to normalized RGB tensor data
    const rgbData = new Float32Array(3 * targetWidth * targetHeight)
    const data = resizedImageData.data
    
    for (let i = 0; i < targetWidth * targetHeight; i++) {
      const pixelIndex = i * 4 // RGBA
      
      // Normalize from [0, 255] to [0, 1] and convert to RGB
      rgbData[i * 3] = data[pixelIndex] / 255.0         // R
      rgbData[i * 3 + 1] = data[pixelIndex + 1] / 255.0 // G
      rgbData[i * 3 + 2] = data[pixelIndex + 2] / 255.0 // B
    }
    
    // Reshape to NCHW format for ONNX
    const tensorData = new Float32Array(3 * targetWidth * targetHeight)
    const channelSize = targetWidth * targetHeight
    
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < channelSize; i++) {
        tensorData[c * channelSize + i] = rgbData[i * 3 + c]
      }
    }
    
    postMessage({
      type: 'success',
      id,
      data: { 
        tensorData,
        imageData: resizedImageData,
        width: targetWidth,
        height: targetHeight
      }
    } as ImageProcessingResponse)
  } else {
    postMessage({
      type: 'success',
      id,
      data: { 
        imageData: processedData,
        width: targetWidth,
        height: targetHeight
      }
    } as ImageProcessingResponse)
  }
}

function performPerspectiveTransform(
  sourceData: ImageData,
  targetData: ImageData,
  corners: { x: number, y: number }[],
  targetWidth: number,
  targetHeight: number
): void {
  const source = sourceData.data
  const target = targetData.data
  
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      // Map target coordinates to source coordinates using bilinear interpolation
      const u = x / targetWidth
      const v = y / targetHeight
      
      const sourceX = 
        corners[0].x * (1 - u) * (1 - v) +
        corners[1].x * u * (1 - v) +
        corners[2].x * u * v +
        corners[3].x * (1 - u) * v
        
      const sourceY = 
        corners[0].y * (1 - u) * (1 - v) +
        corners[1].y * u * (1 - v) +
        corners[2].y * u * v +
        corners[3].y * (1 - u) * v

      // Sample from source image with bounds checking
      const sx = Math.round(sourceX)
      const sy = Math.round(sourceY)
      
      if (sx >= 0 && sx < sourceData.width && sy >= 0 && sy < sourceData.height) {
        const sourceIndex = (sy * sourceData.width + sx) * 4
        const targetIndex = (y * targetWidth + x) * 4
        
        target[targetIndex] = source[sourceIndex]         // R
        target[targetIndex + 1] = source[sourceIndex + 1] // G
        target[targetIndex + 2] = source[sourceIndex + 2] // B
        target[targetIndex + 3] = source[sourceIndex + 3] // A
      } else {
        // Fill with white for out-of-bounds pixels
        const targetIndex = (y * targetWidth + x) * 4
        target[targetIndex] = 255     // R
        target[targetIndex + 1] = 255 // G
        target[targetIndex + 2] = 255 // B
        target[targetIndex + 3] = 255 // A
      }
    }
  }
}

function distance(p1: { x: number, y: number }, p2: { x: number, y: number }): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

export {} // Make this a module