import { Notification, NotificationType, NotificationAction, ProgressNotification } from '../types/notifications'

export class NotificationManager {
  private static instance: NotificationManager
  private notifications: Notification[] = []
  private listeners: ((notifications: Notification[]) => void)[] = []
  private maxNotifications = 5

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  // Basic notification methods
  show(
    type: NotificationType,
    title: string,
    message: string,
    duration: number = 5000,
    actions?: NotificationAction[]
  ): string {
    const notification: Notification = {
      id: this.generateId(),
      type,
      title,
      message,
      duration,
      actions,
      timestamp: new Date()
    }

    this.addNotification(notification)
    
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification.id)
      }, duration)
    }

    return notification.id
  }

  success(title: string, message: string, duration?: number): string {
    return this.show('success', title, message, duration)
  }

  error(title: string, message: string, actions?: NotificationAction[]): string {
    return this.show('error', title, message, 0, actions) // Persistent by default
  }

  warning(title: string, message: string, duration?: number): string {
    return this.show('warning', title, message, duration || 7000)
  }

  info(title: string, message: string, duration?: number): string {
    return this.show('info', title, message, duration)
  }

  // Progress notification methods
  showProgress(
    title: string,
    message: string,
    initialProgress: number = 0,
    stage?: string
  ): string {
    const notification: ProgressNotification = {
      id: this.generateId(),
      type: 'progress',
      title,
      message,
      duration: 0, // Persistent until completed
      progress: initialProgress,
      stage,
      timestamp: new Date()
    }

    this.addNotification(notification)
    return notification.id
  }

  updateProgress(
    id: string,
    progress: number,
    message?: string,
    stage?: string,
    estimatedTime?: number
  ): void {
    const notification = this.notifications.find(n => n.id === id)
    if (notification && notification.type === 'progress') {
      const progressNotification = notification as ProgressNotification
      progressNotification.progress = Math.max(0, Math.min(100, progress))
      
      if (message) progressNotification.message = message
      if (stage) progressNotification.stage = stage
      if (estimatedTime) progressNotification.estimatedTime = estimatedTime

      this.notifyListeners()

      // Auto-remove when complete
      if (progress >= 100) {
        setTimeout(() => {
          this.remove(id)
        }, 2000)
      }
    }
  }

  // Management methods
  remove(id: string): void {
    const index = this.notifications.findIndex(n => n.id === id)
    if (index > -1) {
      this.notifications.splice(index, 1)
      this.notifyListeners()
    }
  }

  clear(): void {
    this.notifications = []
    this.notifyListeners()
  }

  clearByType(type: NotificationType): void {
    this.notifications = this.notifications.filter(n => n.type !== type)
    this.notifyListeners()
  }

  getNotifications(): Notification[] {
    return [...this.notifications]
  }

  // Listener management
  addListener(listener: (notifications: Notification[]) => void): void {
    this.listeners.push(listener)
  }

  removeListener(listener: (notifications: Notification[]) => void): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  // Predefined notification templates
  showOCRProgress(): string {
    return this.showProgress(
      'OCR処理中',
      '画像からテキストを抽出しています...',
      0,
      'モデル初期化'
    )
  }

  showDataExtractionProgress(): string {
    return this.showProgress(
      'データ抽出中',
      '領収書情報を抽出しています...',
      0,
      'テキスト解析'
    )
  }

  showSaveSuccess(): string {
    return this.success(
      '保存完了',
      '領収書データが正常に保存されました',
      3000
    )
  }

  showExportSuccess(format: string): string {
    return this.success(
      'エクスポート完了',
      `${format.toUpperCase()}形式でエクスポートしました`,
      3000
    )
  }

  showCameraError(): string {
    return this.error(
      'カメラエラー',
      'カメラにアクセスできません。ブラウザの設定を確認してください。',
      [{
        label: '設定を確認',
        action: () => {
          window.open('chrome://settings/content/camera', '_blank')
        },
        style: 'primary'
      }]
    )
  }

  showModelLoadError(): string {
    return this.error(
      'モデル読み込みエラー',
      'OCRモデルの読み込みに失敗しました。',
      [{
        label: '再試行',
        action: () => {
          window.location.reload()
        },
        style: 'primary'
      }]
    )
  }

  showLowConfidenceWarning(fieldName: string, confidence: number): string {
    return this.warning(
      '信頼度が低い結果',
      `${fieldName}の抽出結果の信頼度が${Math.round(confidence * 100)}%です。内容を確認してください。`,
      10000
    )
  }

  // Private methods
  private addNotification(notification: Notification): void {
    this.notifications.unshift(notification)
    
    // Limit number of notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications)
    }
    
    this.notifyListeners()
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener([...this.notifications]))
  }

  private generateId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export const notificationManager = NotificationManager.getInstance()