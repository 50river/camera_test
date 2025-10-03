import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { configManager } from '../../utils/configManager'

describe('Config Manager Integration Tests', () => {
  beforeEach(() => {
    // Reset config to defaults before each test
    configManager.resetConfig()
  })

  afterEach(() => {
    // Clean up after each test
    configManager.resetConfig()
  })

  it('should provide default configuration', () => {
    const config = configManager.getConfig()
    
    expect(config).toBeDefined()
    expect(config.ocrSettings).toBeDefined()
    expect(config.uiSettings).toBeDefined()
    expect(config.exportSettings).toBeDefined()
    
    // Check default values
    expect(config.ocrSettings.confidenceThreshold).toBe(0.8)
    expect(config.ocrSettings.detectionModel).toBe('/models/det_model.onnx')
    expect(config.ocrSettings.recognitionModel).toBe('/models/rec_model.onnx')
    expect(config.uiSettings.language).toBe('ja')
    expect(config.uiSettings.theme).toBe('light')
    expect(config.exportSettings.defaultFormat).toBe('json')
    expect(config.exportSettings.includeMetadata).toBe(true)
  })

  it('should validate configuration correctly', () => {
    expect(configManager.validateConfig()).toBe(true)
    
    // Test with invalid confidence threshold
    configManager.updateOCRSettings({ confidenceThreshold: 1.5 })
    expect(configManager.validateConfig()).toBe(false)
    
    // Reset and test valid update
    configManager.resetConfig()
    configManager.updateOCRSettings({ confidenceThreshold: 0.75 })
    expect(configManager.validateConfig()).toBe(true)
  })

  it('should update OCR settings', () => {
    const initialConfig = configManager.getConfig()
    expect(initialConfig.ocrSettings.confidenceThreshold).toBe(0.8)
    
    // Update OCR settings
    configManager.updateOCRSettings({ confidenceThreshold: 0.75 })
    
    const updatedConfig = configManager.getConfig()
    expect(updatedConfig.ocrSettings.confidenceThreshold).toBe(0.75)
    expect(updatedConfig.ocrSettings.detectionModel).toBe('/models/det_model.onnx') // Should remain unchanged
  })

  it('should update UI settings', () => {
    const initialConfig = configManager.getConfig()
    expect(initialConfig.uiSettings.language).toBe('ja')
    expect(initialConfig.uiSettings.theme).toBe('light')
    
    // Update UI settings
    configManager.updateUISettings({ 
      language: 'en',
      theme: 'dark'
    })
    
    const updatedConfig = configManager.getConfig()
    expect(updatedConfig.uiSettings.language).toBe('en')
    expect(updatedConfig.uiSettings.theme).toBe('dark')
  })

  it('should update export settings', () => {
    const initialConfig = configManager.getConfig()
    expect(initialConfig.exportSettings.defaultFormat).toBe('json')
    expect(initialConfig.exportSettings.includeMetadata).toBe(true)
    
    // Update export settings
    configManager.updateExportSettings({ 
      defaultFormat: 'csv',
      includeMetadata: false
    })
    
    const updatedConfig = configManager.getConfig()
    expect(updatedConfig.exportSettings.defaultFormat).toBe('csv')
    expect(updatedConfig.exportSettings.includeMetadata).toBe(false)
  })

  it('should get specific settings sections', () => {
    // Test OCR settings getter
    const ocrSettings = configManager.getOCRSettings()
    expect(ocrSettings.confidenceThreshold).toBe(0.8)
    expect(ocrSettings.detectionModel).toBe('/models/det_model.onnx')
    expect(ocrSettings.recognitionModel).toBe('/models/rec_model.onnx')
    
    // Test UI settings getter
    const uiSettings = configManager.getUISettings()
    expect(uiSettings.language).toBe('ja')
    expect(uiSettings.theme).toBe('light')
    
    // Test export settings getter
    const exportSettings = configManager.getExportSettings()
    expect(exportSettings.defaultFormat).toBe('json')
    expect(exportSettings.includeMetadata).toBe(true)
  })

  it('should export and import configuration', () => {
    // Update some settings
    configManager.updateOCRSettings({ confidenceThreshold: 0.75 })
    configManager.updateUISettings({ language: 'en' })
    
    // Export configuration
    const exportedConfig = configManager.exportConfig()
    expect(typeof exportedConfig).toBe('string')
    
    // Parse and verify exported config
    const parsedConfig = JSON.parse(exportedConfig)
    expect(parsedConfig.ocrSettings.confidenceThreshold).toBe(0.75)
    expect(parsedConfig.uiSettings.language).toBe('en')
    
    // Reset config
    configManager.resetConfig()
    expect(configManager.getConfig().ocrSettings.confidenceThreshold).toBe(0.8)
    expect(configManager.getConfig().uiSettings.language).toBe('ja')
    
    // Import configuration
    const importResult = configManager.importConfig(exportedConfig)
    expect(importResult).toBe(true)
    
    // Verify imported config
    const importedConfig = configManager.getConfig()
    expect(importedConfig.ocrSettings.confidenceThreshold).toBe(0.75)
    expect(importedConfig.uiSettings.language).toBe('en')
  })

  it('should handle invalid import gracefully', () => {
    const invalidJson = '{ invalid json }'
    const importResult = configManager.importConfig(invalidJson)
    expect(importResult).toBe(false)
    
    // Config should remain unchanged
    const config = configManager.getConfig()
    expect(config.ocrSettings.confidenceThreshold).toBe(0.8)
  })

  it('should reset configuration to defaults', () => {
    // Update some settings
    configManager.updateOCRSettings({ confidenceThreshold: 0.75 })
    configManager.updateUISettings({ language: 'en', theme: 'dark' })
    configManager.updateExportSettings({ defaultFormat: 'csv' })
    
    // Verify changes
    let config = configManager.getConfig()
    expect(config.ocrSettings.confidenceThreshold).toBe(0.75)
    expect(config.uiSettings.language).toBe('en')
    expect(config.uiSettings.theme).toBe('dark')
    expect(config.exportSettings.defaultFormat).toBe('csv')
    
    // Reset configuration
    configManager.resetConfig()
    
    // Verify reset to defaults
    config = configManager.getConfig()
    expect(config.ocrSettings.confidenceThreshold).toBe(0.8)
    expect(config.uiSettings.language).toBe('ja')
    expect(config.uiSettings.theme).toBe('light')
    expect(config.exportSettings.defaultFormat).toBe('json')
  })
})