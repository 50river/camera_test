import { AppConfig } from '../types/config'

/**
 * Configuration Manager
 * Handles application configuration with persistence and validation
 */
export class ConfigManager {
  private static instance: ConfigManager
  private config: AppConfig
  private readonly storageKey = 'receipt-ocr-config'
  private readonly defaultConfig: AppConfig = {
    ocrSettings: {
      confidenceThreshold: 0.8,
      detectionModel: '/models/det_model.onnx',
      recognitionModel: '/models/rec_model.onnx'
    },
    uiSettings: {
      language: 'ja',
      theme: 'light'
    },
    exportSettings: {
      defaultFormat: 'json',
      includeMetadata: true
    }
  }

  private constructor() {
    this.config = this.loadConfig()
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  /**
   * Load configuration from localStorage or use defaults
   */
  private loadConfig(): AppConfig {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return this.validateAndMergeConfig(parsed)
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error)
    }
    return { ...this.defaultConfig }
  }

  /**
   * Validate and merge stored config with defaults
   */
  private validateAndMergeConfig(stored: any): AppConfig {
    const config: AppConfig = { ...this.defaultConfig }

    // Validate and merge OCR settings
    if (stored.ocrSettings && typeof stored.ocrSettings === 'object') {
      if (typeof stored.ocrSettings.confidenceThreshold === 'number' &&
          stored.ocrSettings.confidenceThreshold >= 0 &&
          stored.ocrSettings.confidenceThreshold <= 1) {
        config.ocrSettings.confidenceThreshold = stored.ocrSettings.confidenceThreshold
      }
      if (typeof stored.ocrSettings.detectionModel === 'string') {
        config.ocrSettings.detectionModel = stored.ocrSettings.detectionModel
      }
      if (typeof stored.ocrSettings.recognitionModel === 'string') {
        config.ocrSettings.recognitionModel = stored.ocrSettings.recognitionModel
      }
    }

    // Validate and merge UI settings
    if (stored.uiSettings && typeof stored.uiSettings === 'object') {
      if (stored.uiSettings.language === 'ja' || stored.uiSettings.language === 'en') {
        config.uiSettings.language = stored.uiSettings.language
      }
      if (stored.uiSettings.theme === 'light' || stored.uiSettings.theme === 'dark') {
        config.uiSettings.theme = stored.uiSettings.theme
      }
    }

    // Validate and merge export settings
    if (stored.exportSettings && typeof stored.exportSettings === 'object') {
      if (stored.exportSettings.defaultFormat === 'json' || stored.exportSettings.defaultFormat === 'csv') {
        config.exportSettings.defaultFormat = stored.exportSettings.defaultFormat
      }
      if (typeof stored.exportSettings.includeMetadata === 'boolean') {
        config.exportSettings.includeMetadata = stored.exportSettings.includeMetadata
      }
    }

    return config
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config))
    } catch (error) {
      console.error('Failed to save config to localStorage:', error)
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      ocrSettings: {
        ...this.config.ocrSettings,
        ...(updates.ocrSettings || {})
      },
      uiSettings: {
        ...this.config.uiSettings,
        ...(updates.uiSettings || {})
      },
      exportSettings: {
        ...this.config.exportSettings,
        ...(updates.exportSettings || {})
      }
    }
    this.saveConfig()
  }

  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.config = { ...this.defaultConfig }
    this.saveConfig()
  }

  /**
   * Get OCR settings
   */
  public getOCRSettings() {
    return { ...this.config.ocrSettings }
  }

  /**
   * Update OCR settings
   */
  public updateOCRSettings(settings: Partial<AppConfig['ocrSettings']>): void {
    this.updateConfig({ 
      ocrSettings: {
        ...this.config.ocrSettings,
        ...settings
      }
    })
  }

  /**
   * Get UI settings
   */
  public getUISettings() {
    return { ...this.config.uiSettings }
  }

  /**
   * Update UI settings
   */
  public updateUISettings(settings: Partial<AppConfig['uiSettings']>): void {
    this.updateConfig({ 
      uiSettings: {
        ...this.config.uiSettings,
        ...settings
      }
    })
  }

  /**
   * Get export settings
   */
  public getExportSettings() {
    return { ...this.config.exportSettings }
  }

  /**
   * Update export settings
   */
  public updateExportSettings(settings: Partial<AppConfig['exportSettings']>): void {
    this.updateConfig({ 
      exportSettings: {
        ...this.config.exportSettings,
        ...settings
      }
    })
  }

  /**
   * Check if configuration is valid
   */
  public validateConfig(): boolean {
    try {
      const config = this.config
      
      // Validate OCR settings
      if (config.ocrSettings.confidenceThreshold < 0 || config.ocrSettings.confidenceThreshold > 1) {
        return false
      }
      
      // Validate UI settings
      if (!['ja', 'en'].includes(config.uiSettings.language)) {
        return false
      }
      
      if (!['light', 'dark'].includes(config.uiSettings.theme)) {
        return false
      }
      
      // Validate export settings
      if (!['json', 'csv'].includes(config.exportSettings.defaultFormat)) {
        return false
      }
      
      return true
    } catch {
      return false
    }
  }

  /**
   * Export configuration as JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2)
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(configJson: string): boolean {
    try {
      const imported = JSON.parse(configJson)
      const validated = this.validateAndMergeConfig(imported)
      this.config = validated
      this.saveConfig()
      return true
    } catch (error) {
      console.error('Failed to import config:', error)
      return false
    }
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance()