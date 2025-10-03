export interface AppConfig {
  ocrSettings: {
    confidenceThreshold: number
    detectionModel: string
    recognitionModel: string
  }
  uiSettings: {
    language: 'ja' | 'en'
    theme: 'light' | 'dark'
  }
  exportSettings: {
    defaultFormat: 'json' | 'csv'
    includeMetadata: boolean
  }
}

