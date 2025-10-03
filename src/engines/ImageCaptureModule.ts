import { PerspectiveParams } from '../types'
import * as EXIF from 'exif-js'
import { getImageProcessingWorkerManager, ImageProcessingWorkerManager } from '../utils/imageProcessingWorkerManager'

export interface ImageCaptureModule {
  captureFromCamera(): Promise<ImageData>
  selectFromFile(): Promise<ImageData>
  applyEXIFCorrection(image: ImageData): ImageData
  estimatePerspectiveCorrection(image: ImageData): PerspectiveParams
  applyPerspectiveCorrection(image: ImageData, params: PerspectiveParams): Promise<ImageData>
}

export class ImageCaptureModuleImpl implements ImageCaptureModule {
  private workerManager: ImageProcessingWorkerManager | null = null
  private useWebWorker = false

  constructor() {
    // Initialize WebWorker if supported
    if (ImageProcessingWorkerManager.isWebWorkerSupported()) {
      this.workerManager = getImageProcessingWorkerManager()
      this.useWebWorker = true
    }
  }
  async captureFromCamera(): Promise<ImageData> {
    // This method will be used by the UI component to handle camera capture
    // The actual file input handling is done in the component
    throw new Error('Use selectFromFile with camera input instead')
  }

  async selectFromFile(file?: File): Promise<ImageData> {
    if (!file) {
      throw new Error('No file provided')
    }

    // Get EXIF orientation first
    const orientation = await this.getEXIFOrientation(file)

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        const img = new Image()
        
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (!ctx) {
              reject(new Error('Failed to get canvas context'))
              return
            }

            // Set canvas dimensions based on orientation
            if (orientation >= 5 && orientation <= 8) {
              canvas.width = img.height
              canvas.height = img.width
            } else {
              canvas.width = img.width
              canvas.height = img.height
            }

            // Apply EXIF rotation transformation
            this.applyCanvasTransformation(ctx, orientation, img.width, img.height)
            
            // Draw the image with applied transformation
            ctx.drawImage(img, 0, 0)
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            resolve(imageData)
          } catch (error) {
            reject(new Error(`Failed to process image: ${error}`))
          }
        }
        
        img.onerror = () => {
          reject(new Error('Failed to load image'))
        }
        
        if (event.target?.result) {
          img.src = event.target.result as string
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsDataURL(file)
    })
  }

  private applyCanvasTransformation(ctx: CanvasRenderingContext2D, orientation: number, width: number, height: number): void {
    switch (orientation) {
      case 2:
        // Horizontal flip
        ctx.transform(-1, 0, 0, 1, width, 0)
        break
      case 3:
        // 180° rotation
        ctx.transform(-1, 0, 0, -1, width, height)
        break
      case 4:
        // Vertical flip
        ctx.transform(1, 0, 0, -1, 0, height)
        break
      case 5:
        // 90° rotation + horizontal flip
        ctx.transform(0, 1, 1, 0, 0, 0)
        break
      case 6:
        // 90° clockwise rotation
        ctx.transform(0, 1, -1, 0, height, 0)
        break
      case 7:
        // 90° rotation + vertical flip
        ctx.transform(0, -1, -1, 0, height, width)
        break
      case 8:
        // 90° counter-clockwise rotation
        ctx.transform(0, -1, 1, 0, 0, width)
        break
      default:
        // No transformation needed for orientation 1
        break
    }
  }

  applyEXIFCorrection(image: ImageData): ImageData {
    // Note: EXIF correction should be applied during image loading
    // This method applies rotation to an existing ImageData
    // In practice, we'll handle EXIF during the file reading process
    return image
  }

  private getEXIFOrientation(file: File): Promise<number> {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function(this: any) {
        const orientation = EXIF.getTag(this, 'Orientation') || 1
        resolve(orientation)
      })
    })
  }

  private rotateImageData(imageData: ImageData, orientation: number): ImageData {
    if (orientation === 1) {
      return imageData // No rotation needed
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return imageData
    }

    const { width, height } = imageData
    
    // Set canvas dimensions based on rotation
    if (orientation >= 5 && orientation <= 8) {
      canvas.width = height
      canvas.height = width
    } else {
      canvas.width = width
      canvas.height = height
    }

    // Apply transformation based on EXIF orientation
    switch (orientation) {
      case 2:
        // Horizontal flip
        ctx.transform(-1, 0, 0, 1, width, 0)
        break
      case 3:
        // 180° rotation
        ctx.transform(-1, 0, 0, -1, width, height)
        break
      case 4:
        // Vertical flip
        ctx.transform(1, 0, 0, -1, 0, height)
        break
      case 5:
        // 90° rotation + horizontal flip
        ctx.transform(0, 1, 1, 0, 0, 0)
        break
      case 6:
        // 90° clockwise rotation
        ctx.transform(0, 1, -1, 0, height, 0)
        break
      case 7:
        // 90° rotation + vertical flip
        ctx.transform(0, -1, -1, 0, height, width)
        break
      case 8:
        // 90° counter-clockwise rotation
        ctx.transform(0, -1, 1, 0, 0, width)
        break
    }

    // Create a temporary canvas to draw the original image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    
    if (!tempCtx) {
      return imageData
    }

    tempCanvas.width = width
    tempCanvas.height = height
    tempCtx.putImageData(imageData, 0, 0)

    // Draw the rotated image
    ctx.drawImage(tempCanvas, 0, 0)

    // Get the rotated image data
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  estimatePerspectiveCorrection(image: ImageData): PerspectiveParams {
    // Simple automatic perspective estimation
    // This is a basic implementation that assumes the document occupies most of the image
    const { width, height } = image
    
    // For now, return default corners (no correction needed)
    // In a more advanced implementation, we would use edge detection
    // and contour finding to automatically detect document boundaries
    const corners = [
      { x: 0, y: 0 },           // Top-left
      { x: width, y: 0 },       // Top-right
      { x: width, y: height },  // Bottom-right
      { x: 0, y: height }       // Bottom-left
    ]

    // Identity transformation matrix (no transformation)
    const transformMatrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]

    return { corners, transformMatrix }
  }

  async applyPerspectiveCorrection(image: ImageData, params: PerspectiveParams): Promise<ImageData> {
    const { corners } = params
    
    // If corners represent a rectangle (no perspective correction needed)
    if (this.isRectangular(corners)) {
      return image
    }

    try {
      if (this.useWebWorker && this.workerManager) {
        // Use WebWorker for perspective correction
        const result = await this.workerManager.applyPerspectiveCorrection(image, corners)
        return result.imageData
      }
    } catch (error) {
      console.warn('WebWorker perspective correction failed, falling back to main thread:', error)
    }

    // Fallback to main thread processing
    return this.applyPerspectiveCorrectionMainThread(image, corners)
  }

  private applyPerspectiveCorrectionMainThread(image: ImageData, corners: { x: number, y: number }[]): ImageData {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      return image
    }

    // Calculate the target rectangle dimensions
    const targetWidth = Math.max(
      this.distance(corners[0], corners[1]),
      this.distance(corners[3], corners[2])
    )
    const targetHeight = Math.max(
      this.distance(corners[0], corners[3]),
      this.distance(corners[1], corners[2])
    )

    canvas.width = Math.round(targetWidth)
    canvas.height = Math.round(targetHeight)

    // Create source canvas with original image
    const sourceCanvas = document.createElement('canvas')
    const sourceCtx = sourceCanvas.getContext('2d')
    
    if (!sourceCtx) {
      return image
    }

    sourceCanvas.width = image.width
    sourceCanvas.height = image.height
    sourceCtx.putImageData(image, 0, 0)

    // Apply perspective transformation using a simple approach
    this.drawPerspectiveCorrectedImage(ctx, sourceCanvas, corners, canvas.width, canvas.height)

    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  private isRectangular(corners: { x: number; y: number }[]): boolean {
    if (corners.length !== 4) return false
    
    // Check if corners form a rectangle (parallel sides)
    const tolerance = 5 // pixels
    
    // Check if opposite sides are parallel
    const side1 = { x: corners[1].x - corners[0].x, y: corners[1].y - corners[0].y }
    const side3 = { x: corners[2].x - corners[3].x, y: corners[2].y - corners[3].y }
    
    const side2 = { x: corners[2].x - corners[1].x, y: corners[2].y - corners[1].y }
    const side4 = { x: corners[3].x - corners[0].x, y: corners[3].y - corners[0].y }
    
    // Check if sides are parallel (cross product should be near zero)
    const cross1 = Math.abs(side1.x * side3.y - side1.y * side3.x)
    const cross2 = Math.abs(side2.x * side4.y - side2.y * side4.x)
    
    return cross1 < tolerance && cross2 < tolerance
  }

  private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
  }

  private drawPerspectiveCorrectedImage(
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    corners: { x: number; y: number }[],
    targetWidth: number,
    targetHeight: number
  ): void {
    // Simple bilinear interpolation for perspective correction
    // This is a basic implementation
    
    const imageData = ctx.createImageData(targetWidth, targetHeight)
    const data = imageData.data
    const sourceCtx = sourceCanvas.getContext('2d')
    
    if (!sourceCtx) return
    
    const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
    
    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        // Map target coordinates to source coordinates
        const u = x / targetWidth
        const v = y / targetHeight
        
        // Bilinear interpolation of corner positions
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

        // Sample from source image
        const sx = Math.round(sourceX)
        const sy = Math.round(sourceY)
        
        if (sx >= 0 && sx < sourceCanvas.width && sy >= 0 && sy < sourceCanvas.height) {
          const sourceIndex = (sy * sourceCanvas.width + sx) * 4
          const targetIndex = (y * targetWidth + x) * 4
          
          data[targetIndex] = sourceData.data[sourceIndex]         // R
          data[targetIndex + 1] = sourceData.data[sourceIndex + 1] // G
          data[targetIndex + 2] = sourceData.data[sourceIndex + 2] // B
          data[targetIndex + 3] = sourceData.data[sourceIndex + 3] // A
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
  }
}