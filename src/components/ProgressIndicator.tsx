import React from 'react'

interface ProgressIndicatorProps {
  progress: number // 0-100
  message?: string
  stage?: string
  estimatedTime?: number // in seconds
  size?: 'small' | 'medium' | 'large'
  variant?: 'circular' | 'linear'
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  message,
  stage,
  estimatedTime,
  size = 'medium',
  variant = 'circular'
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}分${remainingSeconds}秒`
  }

  const getCircleProps = () => {
    const sizes = {
      small: { radius: 20, strokeWidth: 3 },
      medium: { radius: 30, strokeWidth: 4 },
      large: { radius: 40, strokeWidth: 5 }
    }
    return sizes[size]
  }

  const renderCircularProgress = () => {
    const { radius, strokeWidth } = getCircleProps()
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
      <div className={`progress-circular progress-${size}`}>
        <svg 
          width={(radius + strokeWidth) * 2} 
          height={(radius + strokeWidth) * 2}
          className="progress-svg"
        >
          {/* Background circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke="#e9ecef"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke="#007bff"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${radius + strokeWidth} ${radius + strokeWidth})`}
            className="progress-circle"
          />
        </svg>
        <div className="progress-text">
          <span className="progress-percentage">{Math.round(progress)}%</span>
        </div>
      </div>
    )
  }

  const renderLinearProgress = () => {
    return (
      <div className={`progress-linear progress-${size}`}>
        <div className="progress-track">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-percentage-text">
          {Math.round(progress)}%
        </div>
      </div>
    )
  }

  return (
    <div className="progress-indicator">
      {variant === 'circular' ? renderCircularProgress() : renderLinearProgress()}
      
      {(message || stage || estimatedTime) && (
        <div className="progress-info">
          {message && (
            <div className="progress-message">{message}</div>
          )}
          
          {stage && (
            <div className="progress-stage">
              <span className="stage-label">段階:</span>
              <span className="stage-value">{stage}</span>
            </div>
          )}
          
          {estimatedTime && estimatedTime > 0 && (
            <div className="progress-eta">
              <span className="eta-label">残り時間:</span>
              <span className="eta-value">{formatTime(estimatedTime)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Hook for managing progress state
export const useProgress = () => {
  const [progress, setProgress] = React.useState(0)
  const [message, setMessage] = React.useState<string>('')
  const [stage, setStage] = React.useState<string>('')
  const [estimatedTime, setEstimatedTime] = React.useState<number>(0)
  const [isActive, setIsActive] = React.useState(false)

  const startProgress = (initialMessage?: string, initialStage?: string) => {
    setProgress(0)
    setMessage(initialMessage || '')
    setStage(initialStage || '')
    setEstimatedTime(0)
    setIsActive(true)
  }

  const updateProgress = (
    newProgress: number,
    newMessage?: string,
    newStage?: string,
    newEstimatedTime?: number
  ) => {
    setProgress(Math.max(0, Math.min(100, newProgress)))
    if (newMessage !== undefined) setMessage(newMessage)
    if (newStage !== undefined) setStage(newStage)
    if (newEstimatedTime !== undefined) setEstimatedTime(newEstimatedTime)
  }

  const completeProgress = (completionMessage?: string) => {
    setProgress(100)
    if (completionMessage) setMessage(completionMessage)
    
    // Auto-hide after completion
    setTimeout(() => {
      setIsActive(false)
    }, 2000)
  }

  const resetProgress = () => {
    setProgress(0)
    setMessage('')
    setStage('')
    setEstimatedTime(0)
    setIsActive(false)
  }

  return {
    progress,
    message,
    stage,
    estimatedTime,
    isActive,
    startProgress,
    updateProgress,
    completeProgress,
    resetProgress
  }
}