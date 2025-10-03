import React, { useRef, useState } from 'react'
import { ImageCaptureModuleImpl } from '../engines/ImageCaptureModule'
import { errorHandler } from '../utils/errorHandler'
import { useNotifications } from './NotificationCenter'

interface CameraCaptureProps {
  onImageCapture: (imageData: ImageData) => void
  onError: (error: Error) => void
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onImageCapture, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const imageCaptureModule = new ImageCaptureModuleImpl()
  const notifications = useNotifications()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    
    if (!file) {
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const error = new Error('選択されたファイルは画像ではありません')
      error.name = 'INVALID_IMAGE_FORMAT'
      onError(error)
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      const error = new Error('ファイルサイズが大きすぎます（最大10MB）')
      error.name = 'IMAGE_TOO_LARGE'
      onError(error)
      return
    }

    // Check minimum size
    const img = new Image()
    img.onload = () => {
      if (img.width < 100 || img.height < 100) {
        const error = new Error('画像が小さすぎます。より高解像度の画像を使用してください。')
        error.name = 'IMAGE_TOO_SMALL'
        onError(error)
        return
      }
    }
    img.src = URL.createObjectURL(file)

    setIsProcessing(true)

    try {
      notifications.showInfo('画像処理中', 'ファイルを読み込んでいます...', 2000)
      const imageData = await imageCaptureModule.selectFromFile(file)
      notifications.showSuccess('読み込み完了', '画像が正常に読み込まれました', 2000)
      onImageCapture(imageData)
    } catch (error) {
      const appError = errorHandler.handleError(error as Error, {
        component: 'CameraCapture',
        operation: 'file_select',
        metadata: { 
          fileInput: fileInputRef.current,
          fileName: file.name,
          fileSize: file.size
        }
      })
      const standardError = new Error(appError.message)
      standardError.name = appError.type
      onError(standardError)
    } finally {
      setIsProcessing(false)
      // Reset the input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCameraClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileClick = () => {
    // Remove capture attribute for file selection
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('capture')
      fileInputRef.current.click()
      // Restore capture attribute after click
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.setAttribute('capture', 'environment')
        }
      }, 100)
    }
  }

  return (
    <div className="camera-capture">
      <h2>画像を選択または撮影</h2>
      
      <div className="capture-buttons">
        <button 
          onClick={handleCameraClick}
          disabled={isProcessing}
          className="camera-button"
        >
          {isProcessing ? '処理中...' : 'カメラで撮影'}
        </button>
        
        <button 
          onClick={handleFileClick}
          disabled={isProcessing}
          className="file-button"
        >
          {isProcessing ? '処理中...' : 'ファイルを選択'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      {isProcessing && (
        <div className="processing-indicator">
          画像を読み込み中...
        </div>
      )}
    </div>
  )
}