import React, { useState, useEffect } from 'react'
import { Notification, ProgressNotification } from '../types/notifications'
import { notificationManager } from '../utils/notificationManager'

interface NotificationItemProps {
  notification: Notification
  onRemove: (id: string) => void
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRemove }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      case 'progress': return '⏳'
      default: return 'ℹ️'
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const isProgress = notification.type === 'progress'
  const progressNotification = isProgress ? notification as ProgressNotification : null

  return (
    <div className={`notification notification-${notification.type}`}>
      <div className="notification-header">
        <span className="notification-icon">{getIcon(notification.type)}</span>
        <span className="notification-title">{notification.title}</span>
        <span className="notification-time">{formatTime(notification.timestamp)}</span>
        {notification.duration === 0 && (
          <button 
            className="notification-close"
            onClick={() => onRemove(notification.id)}
            aria-label="通知を閉じる"
          >
            ×
          </button>
        )}
      </div>
      
      <div className="notification-content">
        <p className="notification-message">{notification.message}</p>
        
        {isProgress && progressNotification && (
          <div className="notification-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progressNotification.progress}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percentage">
                {Math.round(progressNotification.progress)}%
              </span>
              {progressNotification.stage && (
                <span className="progress-stage">
                  {progressNotification.stage}
                </span>
              )}
              {progressNotification.estimatedTime && (
                <span className="progress-eta">
                  残り約{Math.round(progressNotification.estimatedTime / 1000)}秒
                </span>
              )}
            </div>
          </div>
        )}
        
        {notification.actions && notification.actions.length > 0 && (
          <div className="notification-actions">
            {notification.actions.map((action, index) => (
              <button
                key={index}
                className={`notification-action ${action.style || 'secondary'}`}
                onClick={() => {
                  action.action()
                  if (action.style !== 'secondary') {
                    onRemove(notification.id)
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface NotificationCenterProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxVisible?: number
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  position = 'top-right',
  maxVisible = 5
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    const handleNotificationsChange = (newNotifications: Notification[]) => {
      setNotifications(newNotifications.slice(0, maxVisible))
    }

    notificationManager.addListener(handleNotificationsChange)
    
    // Get initial notifications
    setNotifications(notificationManager.getNotifications().slice(0, maxVisible))

    return () => {
      notificationManager.removeListener(handleNotificationsChange)
    }
  }, [maxVisible])

  const handleRemove = (id: string) => {
    notificationManager.remove(id)
  }

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className={`notification-center notification-center-${position}`}>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={handleRemove}
        />
      ))}
    </div>
  )
}

// Hook for using notifications in components
export const useNotifications = () => {
  const showSuccess = (title: string, message: string, duration?: number) => {
    return notificationManager.success(title, message, duration)
  }

  const showError = (title: string, message: string, actions?: any[]) => {
    return notificationManager.error(title, message, actions)
  }

  const showWarning = (title: string, message: string, duration?: number) => {
    return notificationManager.warning(title, message, duration)
  }

  const showInfo = (title: string, message: string, duration?: number) => {
    return notificationManager.info(title, message, duration)
  }

  const showProgress = (title: string, message: string, initialProgress?: number, stage?: string) => {
    return notificationManager.showProgress(title, message, initialProgress, stage)
  }

  const updateProgress = (id: string, progress: number, message?: string, stage?: string) => {
    notificationManager.updateProgress(id, progress, message, stage)
  }

  const remove = (id: string) => {
    notificationManager.remove(id)
  }

  const clear = () => {
    notificationManager.clear()
  }

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showProgress,
    updateProgress,
    remove,
    clear
  }
}