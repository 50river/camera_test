import React, { Component, ReactNode } from 'react'
import { AppError } from '../types/errors'
import { errorHandler } from '../utils/errorHandler'
import { errorRecovery } from '../utils/errorRecovery'

interface Props {
  children: ReactNode
  fallback?: (error: AppError, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: AppError | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    const appError = errorHandler.handleError(error, {
      component: 'ErrorBoundary',
      operation: 'render'
    })

    return {
      hasError: true,
      error: appError,
      errorId: `error_${Date.now()}`
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    
    const appError = errorHandler.handleError(error, {
      component: 'ErrorBoundary',
      operation: 'render',
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    })

    // Handle critical errors
    if (appError.type === 'system') {
      errorRecovery.handleCriticalError(appError)
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null
    })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry)
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>エラーが発生しました</h2>
            <p className="error-message">
              {errorHandler.getLocalizedMessage(this.state.error)}
            </p>
            
            {this.state.error.details && (
              <details className="error-details">
                <summary>詳細情報</summary>
                <pre>{this.state.error.details}</pre>
              </details>
            )}

            <div className="error-actions">
              <button 
                className="primary-button"
                onClick={this.handleRetry}
              >
                再試行
              </button>
              
              <button 
                className="secondary-button"
                onClick={() => window.location.reload()}
              >
                ページを再読み込み
              </button>
            </div>

            <div className="error-suggestions">
              {errorRecovery.suggestImageImprovement(this.state.error).map((suggestion, index) => (
                <div key={index} className="suggestion">
                  💡 {suggestion}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  const handleError = (error: Error | AppError, context?: any) => {
    const appError = errorHandler.handleError(error, context)
    
    // You can add additional logic here, like showing toast notifications
    console.error('Error handled:', appError)
    
    return appError
  }

  return { handleError }
}