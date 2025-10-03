import { OCREngine, TextDetection, TextRecognition, OCRResult, Rectangle } from '../types'
import { InferenceSession, Tensor } from 'onnxruntime-web'
import { getModelManager } from '../utils/modelManager'
import { getImageProcessingWorkerManager, ImageProcessingWorkerManager } from '../utils/imageProcessingWorkerManager'

export class PaddleOCREngine implements OCREngine {
  private detectionSession: InferenceSession | null = null
  private recognitionSession: InferenceSession | null = null
  private initialized = false
  private ort: any = null
  private modelManager = getModelManager()
  private workerManager: ImageProcessingWorkerManager | null = null
  private useWebWorker = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      // Dynamic import to avoid bundling issues
      this.ort = await import('onnxruntime-web')
      
      // Initialize model manager for lazy loading
      await this.modelManager.initialize()
      
      // Initialize WebWorker if supported
      if (ImageProcessingWorkerManager.isWebWorkerSupported()) {
        try {
          this.workerManager = getImageProcessingWorkerManager()
          await this.workerManager.initialize()
          this.useWebWorker = true
          console.log('WebWorker enabled for image processing')
        } catch (error) {
          console.warn('WebWorker initialization failed, falling back to main thread:', error)
          this.useWebWorker = false
        }
      } else {
        console.log('WebWorker not supported, using main thread for image processing')
        this.useWebWorker = false
      }
      
      this.initialized = true
      console.log('PaddleOCR engine initialized successfully')
    } catch (error) {
      console.error('Failed to initialize OCR engine:', error)
      throw new Error(`Failed to initialize OCR engine: ${error}`)
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }

  getModelInfo(): { detection: any, recognition: any } | null {
    if (!this.initialized) {
      return null
    }
    
    // Get model info from model manager
    const modelInfo = this.modelManager.getModelInfo()
    const cacheInfo = this.modelManager.getCacheInfo()
    
    return {
      detection: {
        loaded: modelInfo.find(m => m.name === 'detection')?.loaded || false,
        inputNames: this.detectionSession?.inputNames || [],
        outputNames: this.detectionSession?.outputNames || [],
        cache: cacheInfo,
        webWorker: this.useWebWorker
      },
      recognition: {
        loaded: modelInfo.find(m => m.name === 'recognition')?.loaded || false,
        inputNames: this.recognitionSession?.inputNames || [],
        outputNames: this.recognitionSession?.outputNames || [],
      }
    }
  }

  async detectText(image: ImageData): Promise<TextDetection[]> {
    if (!this.initialized) {
      throw new Error('OCR engine not initialized')
    }
    
    try {
      // Lazy load detection model
      this.detectionSession = await this.modelManager.getModel('detection')
      
      // Preprocess image for detection (using WebWorker if available)
      const preprocessedTensor = await this.preprocessImageForDetection(image)
      
      // Run detection inference
      const feeds = { [this.detectionSession.inputNames[0]]: preprocessedTensor }
      const results = await this.detectionSession.run(feeds)
      
      // Postprocess detection results
      const detections = this.postprocessDetectionResults(results, image.width, image.height)
      
      return detections
    } catch (error) {
      console.error('Text detection failed:', error)
      throw new Error(`Text detection failed: ${error}`)
    }
  }

  private async preprocessImageForDetection(image: ImageData): Promise<Tensor> {
    // PaddleOCR detection model expects input shape [1, 3, H, W]
    // with values normalized to [0, 1] and RGB format
    
    const targetSize = 640 // Standard detection model input size
    
    try {
      let resizedData: Uint8ClampedArray
      let newWidth: number
      let newHeight: number
      let tensorData: Float32Array | undefined
      
      if (this.useWebWorker && this.workerManager) {
        // Use WebWorker for preprocessing
        const result = await this.workerManager.preprocessForOCR(
          image, 
          targetSize, 
          targetSize, 
          true // normalize
        )
        
        if (result.tensorData) {
          // Worker already provided normalized tensor data
          return new this.ort.Tensor('float32', result.tensorData, [1, 3, result.height, result.width])
        } else {
          // Fallback to manual processing
          resizedData = result.imageData.data
          newWidth = result.width
          newHeight = result.height
        }
      } else {
        // Fallback to main thread processing
        const resizeResult = this.resizeImageDataForDetection(image, targetSize)
        resizedData = resizeResult.resizedData
        newWidth = resizeResult.newWidth
        newHeight = resizeResult.newHeight
      }
      
      // Convert RGBA to RGB and normalize to [0, 1] if not done by worker
      if (!tensorData) {
        const rgbData = new Float32Array(3 * newWidth * newHeight)
        
        for (let i = 0; i < newWidth * newHeight; i++) {
          const pixelIndex = i * 4 // RGBA
          const rgbIndex = i * 3   // RGB
          
          // Normalize from [0, 255] to [0, 1] and convert to RGB
          rgbData[rgbIndex] = resizedData[pixelIndex] / 255.0         // R
          rgbData[rgbIndex + 1] = resizedData[pixelIndex + 1] / 255.0 // G
          rgbData[rgbIndex + 2] = resizedData[pixelIndex + 2] / 255.0 // B
        }
        
        // Reshape to [1, 3, H, W] format (NCHW)
        tensorData = new Float32Array(3 * newWidth * newHeight)
        const channelSize = newWidth * newHeight
        
        for (let c = 0; c < 3; c++) {
          for (let i = 0; i < channelSize; i++) {
            tensorData[c * channelSize + i] = rgbData[i * 3 + c]
          }
        }
      }
      
      return new this.ort.Tensor('float32', tensorData, [1, 3, newHeight, newWidth])
    } catch (error) {
      console.warn('WebWorker preprocessing failed, falling back to main thread:', error)
      
      // Fallback to original implementation
      const { resizedData, newWidth, newHeight } = this.resizeImageDataForDetection(image, targetSize)
      
      const rgbData = new Float32Array(3 * newWidth * newHeight)
      
      for (let i = 0; i < newWidth * newHeight; i++) {
        const pixelIndex = i * 4 // RGBA
        const rgbIndex = i * 3   // RGB
        
        rgbData[rgbIndex] = resizedData[pixelIndex] / 255.0
        rgbData[rgbIndex + 1] = resizedData[pixelIndex + 1] / 255.0
        rgbData[rgbIndex + 2] = resizedData[pixelIndex + 2] / 255.0
      }
      
      const tensorData = new Float32Array(3 * newWidth * newHeight)
      const channelSize = newWidth * newHeight
      
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < channelSize; i++) {
          tensorData[c * channelSize + i] = rgbData[i * 3 + c]
        }
      }
      
      return new this.ort.Tensor('float32', tensorData, [1, 3, newHeight, newWidth])
    }
  }

  private resizeImageDataForDetection(image: ImageData, targetSize: number): {
    resizedData: Uint8ClampedArray,
    newWidth: number,
    newHeight: number
  } {
    // Calculate new dimensions maintaining aspect ratio
    const { width, height } = image
    const scale = Math.min(targetSize / width, targetSize / height)
    const newWidth = Math.round(width * scale)
    const newHeight = Math.round(height * scale)
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = newWidth
    canvas.height = newHeight
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!
    tempCanvas.width = width
    tempCanvas.height = height
    
    // Put original image data
    tempCtx.putImageData(image, 0, 0)
    
    // Resize using canvas
    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, newWidth, newHeight)
    
    // Get resized image data
    const resizedImageData = ctx.getImageData(0, 0, newWidth, newHeight)
    
    return {
      resizedData: resizedImageData.data,
      newWidth,
      newHeight
    }
  }

  private postprocessDetectionResults(results: any, originalWidth: number, originalHeight: number): TextDetection[] {
    // PaddleOCR detection output is typically a probability map
    // This is a simplified implementation - actual PaddleOCR postprocessing is more complex
    
    try {
      const outputTensor = results[this.detectionSession!.outputNames[0]]
      const outputData = outputTensor.data as Float32Array
      const [batchSize, channels, height, width] = outputTensor.dims
      
      const detections: TextDetection[] = []
      const threshold = 0.3 // Confidence threshold for text detection
      
      // Simplified bounding box extraction
      // In real PaddleOCR, this involves contour detection and polygon approximation
      for (let y = 0; y < height; y += 8) {
        for (let x = 0; x < width; x += 8) {
          const index = y * width + x
          const confidence = outputData[index]
          
          if (confidence > threshold) {
            // Scale coordinates back to original image size
            const scaleX = originalWidth / width
            const scaleY = originalHeight / height
            
            const bbox: Rectangle = {
              x: Math.max(0, (x - 4) * scaleX),
              y: Math.max(0, (y - 4) * scaleY),
              width: Math.min(originalWidth, 8 * scaleX),
              height: Math.min(originalHeight, 8 * scaleY)
            }
            
            detections.push({
              bbox,
              confidence
            })
          }
        }
      }
      
      // Merge nearby detections (simple non-maximum suppression)
      return this.mergeNearbyDetections(detections)
      
    } catch (error) {
      console.error('Detection postprocessing failed:', error)
      return []
    }
  }

  private mergeNearbyDetections(detections: TextDetection[]): TextDetection[] {
    if (detections.length === 0) return []
    
    // Sort by confidence (highest first)
    detections.sort((a, b) => b.confidence - a.confidence)
    
    const merged: TextDetection[] = []
    const used = new Set<number>()
    
    for (let i = 0; i < detections.length; i++) {
      if (used.has(i)) continue
      
      const current = detections[i]
      let mergedBbox = { ...current.bbox }
      let maxConfidence = current.confidence
      
      // Find overlapping detections
      for (let j = i + 1; j < detections.length; j++) {
        if (used.has(j)) continue
        
        const other = detections[j]
        if (this.boxesOverlap(current.bbox, other.bbox)) {
          // Merge bounding boxes
          mergedBbox = this.mergeBoundingBoxes(mergedBbox, other.bbox)
          maxConfidence = Math.max(maxConfidence, other.confidence)
          used.add(j)
        }
      }
      
      merged.push({
        bbox: mergedBbox,
        confidence: maxConfidence
      })
      used.add(i)
    }
    
    return merged
  }

  private boxesOverlap(box1: Rectangle, box2: Rectangle): boolean {
    return !(box1.x + box1.width < box2.x || 
             box2.x + box2.width < box1.x || 
             box1.y + box1.height < box2.y || 
             box2.y + box2.height < box1.y)
  }

  private mergeBoundingBoxes(box1: Rectangle, box2: Rectangle): Rectangle {
    const x = Math.min(box1.x, box2.x)
    const y = Math.min(box1.y, box2.y)
    const right = Math.max(box1.x + box1.width, box2.x + box2.width)
    const bottom = Math.max(box1.y + box1.height, box2.y + box2.height)
    
    return {
      x,
      y,
      width: right - x,
      height: bottom - y
    }
  }

  async recognizeText(image: ImageData, regions: TextDetection[]): Promise<TextRecognition[]> {
    if (!this.initialized) {
      throw new Error('OCR engine not initialized')
    }
    
    const recognitions: TextRecognition[] = []
    
    try {
      // Lazy load recognition model
      this.recognitionSession = await this.modelManager.getModel('recognition')
      
      // Process regions in batches to avoid memory issues
      const batchSize = 5 // Process 5 regions at a time
      
      for (let i = 0; i < regions.length; i += batchSize) {
        const batch = regions.slice(i, i + batchSize)
        const batchPromises = batch.map(async (region) => {
          try {
            // Crop text region from original image (using WebWorker if available)
            const croppedImage = await this.cropImageRegion(image, region.bbox)
            
            // Preprocess for recognition
            const preprocessedTensor = await this.preprocessImageForRecognition(croppedImage)
            
            // Run recognition inference
            const feeds = { [this.recognitionSession!.inputNames[0]]: preprocessedTensor }
            const results = await this.recognitionSession!.run(feeds)
            
            // Decode recognition results
            const { text, confidence } = this.decodeRecognitionResult(results)
            
            if (text.trim().length > 0) {
              return {
                text: text.trim(),
                confidence: confidence * region.confidence, // Combine detection and recognition confidence
                bbox: region.bbox
              }
            }
            return null
          } catch (error) {
            console.warn(`Recognition failed for region:`, error)
            return null
          }
        })
        
        const batchResults = await Promise.all(batchPromises)
        recognitions.push(...batchResults.filter(r => r !== null) as TextRecognition[])
        
        // Small delay between batches to prevent blocking
        if (i + batchSize < regions.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
      
      return recognitions
    } catch (error) {
      console.error('Text recognition failed:', error)
      throw new Error(`Text recognition failed: ${error}`)
    }
  }

  private async cropImageRegion(image: ImageData, bbox: Rectangle): Promise<ImageData> {
    // Ensure bbox is within image bounds
    const x = Math.max(0, Math.floor(bbox.x))
    const y = Math.max(0, Math.floor(bbox.y))
    const width = Math.min(image.width - x, Math.ceil(bbox.width))
    const height = Math.min(image.height - y, Math.ceil(bbox.height))
    
    const region = { x, y, width, height }
    
    try {
      if (this.useWebWorker && this.workerManager) {
        // Use WebWorker for cropping
        const result = await this.workerManager.cropImage(image, region)
        return result.imageData
      }
    } catch (error) {
      console.warn('WebWorker cropping failed, falling back to main thread:', error)
    }
    
    // Fallback to main thread cropping
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = width
    canvas.height = height
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!
    tempCanvas.width = image.width
    tempCanvas.height = image.height
    
    // Put original image data
    tempCtx.putImageData(image, 0, 0)
    
    // Crop the region
    ctx.drawImage(tempCanvas, x, y, width, height, 0, 0, width, height)
    
    // Return cropped image data
    return ctx.getImageData(0, 0, width, height)
  }

  private async preprocessImageForRecognition(image: ImageData): Promise<Tensor> {
    // PaddleOCR recognition model expects input shape [1, 3, 32, W]
    // where W is variable width (typically 320 for Japanese)
    
    const targetHeight = 32
    const maxWidth = 320
    
    // Calculate new width maintaining aspect ratio
    const scale = targetHeight / image.height
    const newWidth = Math.min(maxWidth, Math.round(image.width * scale))
    
    try {
      if (this.useWebWorker && this.workerManager) {
        // Use WebWorker for preprocessing
        const result = await this.workerManager.preprocessForOCR(
          image, 
          newWidth, 
          targetHeight, 
          true // normalize
        )
        
        if (result.tensorData) {
          return new this.ort.Tensor('float32', result.tensorData, [1, 3, targetHeight, newWidth])
        }
      }
    } catch (error) {
      console.warn('WebWorker recognition preprocessing failed, falling back to main thread:', error)
    }
    
    // Fallback to main thread processing
    const { resizedData } = this.resizeImageDataForRecognition(image, newWidth, targetHeight)
    
    // Convert RGBA to RGB and normalize
    const rgbData = new Float32Array(3 * newWidth * targetHeight)
    
    for (let i = 0; i < newWidth * targetHeight; i++) {
      const pixelIndex = i * 4 // RGBA
      
      // Normalize from [0, 255] to [0, 1] and convert to RGB
      rgbData[i * 3] = resizedData[pixelIndex] / 255.0         // R
      rgbData[i * 3 + 1] = resizedData[pixelIndex + 1] / 255.0 // G
      rgbData[i * 3 + 2] = resizedData[pixelIndex + 2] / 255.0 // B
    }
    
    // Reshape to [1, 3, H, W] format (NCHW)
    const tensorData = new Float32Array(3 * newWidth * targetHeight)
    const channelSize = newWidth * targetHeight
    
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < channelSize; i++) {
        tensorData[c * channelSize + i] = rgbData[i * 3 + c]
      }
    }
    
    return new this.ort.Tensor('float32', tensorData, [1, 3, targetHeight, newWidth])
  }

  private resizeImageDataForRecognition(image: ImageData, targetWidth: number, targetHeight: number): {
    resizedData: Uint8ClampedArray
  } {
    // Create canvas for resizing
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    canvas.width = targetWidth
    canvas.height = targetHeight
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')!
    tempCanvas.width = image.width
    tempCanvas.height = image.height
    
    // Put original image data
    tempCtx.putImageData(image, 0, 0)
    
    // Resize using canvas
    ctx.drawImage(tempCanvas, 0, 0, image.width, image.height, 0, 0, targetWidth, targetHeight)
    
    // Get resized image data
    const resizedImageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
    
    return {
      resizedData: resizedImageData.data
    }
  }

  private decodeRecognitionResult(results: any): { text: string, confidence: number } {
    try {
      const outputTensor = results[this.recognitionSession!.outputNames[0]]
      const outputData = outputTensor.data as Float32Array
      const [batchSize, seqLength, vocabSize] = outputTensor.dims
      
      // Simple character decoding for Japanese text
      // In real PaddleOCR, this would use a proper character dictionary
      const japaneseChars = this.getJapaneseCharacterSet()
      
      let decodedText = ''
      let totalConfidence = 0
      let validChars = 0
      
      // Decode sequence using argmax
      for (let t = 0; t < seqLength; t++) {
        let maxProb = -Infinity
        let maxIndex = 0
        
        // Find character with highest probability at this timestep
        for (let c = 0; c < vocabSize && c < japaneseChars.length; c++) {
          const prob = outputData[t * vocabSize + c]
          if (prob > maxProb) {
            maxProb = prob
            maxIndex = c
          }
        }
        
        // Add character if confidence is above threshold
        if (maxProb > 0.1 && maxIndex > 0 && maxIndex < japaneseChars.length) {
          const char = japaneseChars[maxIndex]
          if (char !== '<blank>' && char !== '<pad>') {
            decodedText += char
            totalConfidence += maxProb
            validChars++
          }
        }
      }
      
      const avgConfidence = validChars > 0 ? totalConfidence / validChars : 0
      
      return {
        text: decodedText,
        confidence: Math.min(1.0, Math.max(0.0, avgConfidence))
      }
      
    } catch (error) {
      console.error('Recognition decoding failed:', error)
      return { text: '', confidence: 0 }
    }
  }

  private getJapaneseCharacterSet(): string[] {
    // Simplified Japanese character set for demonstration
    // In production, this would be loaded from PaddleOCR's character dictionary
    return [
      '<blank>', '<pad>',
      // Numbers
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      // Basic Latin
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      // Common symbols
      '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
      ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~',
      // Japanese symbols
      '¥', '円', '年', '月', '日', '時', '分', '秒',
      // Common hiragana
      'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ',
      'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と',
      'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ',
      'ま', 'み', 'む', 'め', 'も', 'や', 'ゆ', 'よ',
      'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'を', 'ん',
      // Common katakana
      'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
      'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
      'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
      'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ',
      'ラ', 'リ', 'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン',
      // Common kanji
      '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
      '百', '千', '万', '億', '兆',
      '株', '式', '会', '社', '有', '限', '店', '商', '堂', '薬', '局',
      '合', '計', '税', '込', '金', '額', '領', '収', '書', '請', '求',
      '日', '付', '支', '払', '先', '適', '用', '内', '容'
    ]
  }

  async processFullImage(image: ImageData): Promise<OCRResult[]> {
    const detections = await this.detectText(image)
    const recognitions = await this.recognizeText(image, detections)
    
    return recognitions.map(recognition => ({
      text: recognition.text,
      confidence: recognition.confidence,
      bbox: recognition.bbox,
      candidates: [recognition.text]
    }))
  }

  async processRegion(image: ImageData, region: Rectangle): Promise<OCRResult[]> {
    if (!this.initialized) {
      throw new Error('OCR engine not initialized')
    }
    
    try {
      // Crop the specified region
      const croppedImage = await this.cropImageRegion(image, region)
      
      // Run detection on the cropped region
      const detections = await this.detectText(croppedImage)
      
      // Run recognition on detected text regions
      const recognitions = await this.recognizeText(croppedImage, detections)
      
      // Convert to OCRResult format with adjusted coordinates
      return recognitions.map(recognition => ({
        text: recognition.text,
        confidence: recognition.confidence,
        bbox: {
          x: region.x + recognition.bbox.x,
          y: region.y + recognition.bbox.y,
          width: recognition.bbox.width,
          height: recognition.bbox.height
        },
        candidates: [recognition.text]
      }))
    } catch (error) {
      console.error('Region processing failed:', error)
      throw new Error(`Region processing failed: ${error}`)
    }
  }

  // Performance optimization methods
  async preloadModels(): Promise<void> {
    if (!this.initialized) {
      throw new Error('OCR engine not initialized')
    }
    
    console.log('Preloading OCR models...')
    await this.modelManager.preloadModels(['detection', 'recognition'])
  }

  getPerformanceInfo(): {
    modelCache: any
    webWorker: boolean
    memoryUsage?: any
  } {
    const info: any = {
      modelCache: this.modelManager.getCacheInfo(),
      webWorker: this.useWebWorker
    }
    
    // Add memory info if available
    if (typeof window !== 'undefined' && 'memory' in performance) {
      info.memoryUsage = (performance as any).memory
    }
    
    return info
  }

  async clearCache(): Promise<void> {
    await this.modelManager.clearCache()
    this.detectionSession = null
    this.recognitionSession = null
  }

  destroy(): void {
    console.log('Destroying OCR engine...')
    
    // Clear model cache
    this.modelManager.clearCache()
    
    // Terminate WebWorker
    if (this.workerManager) {
      this.workerManager.terminate()
      this.workerManager = null
    }
    
    // Reset state
    this.detectionSession = null
    this.recognitionSession = null
    this.initialized = false
    this.useWebWorker = false
    
    console.log('OCR engine destroyed')
  }
}