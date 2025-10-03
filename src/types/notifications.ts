export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'progress'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  duration?: number // in milliseconds, 0 for persistent
  actions?: NotificationAction[]
  progress?: number // 0-100 for progress notifications
  timestamp: Date
}

export interface NotificationAction {
  label: string
  action: () => void
  style?: 'primary' | 'secondary' | 'danger'
}

export interface ProgressNotification extends Notification {
  type: 'progress'
  progress: number
  stage?: string
  estimatedTime?: number
}

export interface NotificationState {
  notifications: Notification[]
  maxNotifications: number
}