import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { serviceRegistry } from '../../utils/serviceRegistry'
import { configManager } from '../../utils/configManager'
import { appLifecycle } from '../../utils/appLifecycle'

describe('Service Layer Integration Tests', () => {
  beforeEach(async () => {
    // Clean up any existing state
    await serviceRegistry.destroy()
  })

  afterEach(async () => {
    cleanup()
    await serviceRegistry.destroy()
  })

  it('should initialize service registry successfully', async () => {
    // Initialize service registry
    await serviceRegistry.initialize()

    // Verify initialization
    expect(serviceRegistry.getStatus().initialized).toBe(true)
    expect(serviceRegistry.getStatus().serviceCount).toBeGreaterThan(0)

    // Verify core services are registered
    const serviceNames = serviceRegistry.getServiceNames()
    expect(serviceNames).toContain('configManager')
    expect(serviceNames).toContain('appLifecycle')
    expect(serviceNames).toContain('ocrEngine')
    expect(serviceNames).toContain('dataExtractor')
    expect(serviceNames).toContain('storage')
  })

  it('should provide access to config manager', async () => {
    await serviceRegistry.initialize()

    // Get config manager from registry
    const configMgr = serviceRegistry.getConfigManager()
    expect(configMgr).toBeDefined()

    // Test config operations
    const config = (configMgr as any).getConfig()
    expect(config).toBeDefined()
    expect(config.ocrSettings).toBeDefined()
    expect(config.uiSettings).toBeDefined()
    expect(config.exportSettings).toBeDefined()

    // Test config validation
    expect((configMgr as any).validateConfig()).toBe(true)
  })

  it('should handle service dependencies correctly', async () => {
    await serviceRegistry.initialize()

    // Verify all services are accessible
    expect(() => serviceRegistry.getOCREngine()).not.toThrow()
    expect(() => serviceRegistry.getDataExtractor()).not.toThrow()
    expect(() => serviceRegistry.getStorage()).not.toThrow()
    expect(() => serviceRegistry.getConfigManager()).not.toThrow()
  })

  it('should provide performance metrics', async () => {
    await serviceRegistry.initialize()

    const metrics = serviceRegistry.getPerformanceMetrics()
    expect(metrics).toBeDefined()
    expect(metrics!.registry).toBeDefined()
    expect(metrics!.lifecycle).toBeDefined()
    expect(metrics!.memory).toBeDefined()
  })

  it('should handle config updates', async () => {
    await serviceRegistry.initialize()

    const configMgr = serviceRegistry.getConfigManager() as any
    
    // Get initial config
    const initialConfig = configMgr.getConfig()
    const initialThreshold = initialConfig.ocrSettings.confidenceThreshold

    // Update config
    configMgr.updateOCRSettings({ confidenceThreshold: 0.75 })

    // Verify update
    const updatedConfig = configMgr.getConfig()
    expect(updatedConfig.ocrSettings.confidenceThreshold).toBe(0.75)

    // Reset config
    configMgr.updateOCRSettings({ confidenceThreshold: initialThreshold })
    const resetConfig = configMgr.getConfig()
    expect(resetConfig.ocrSettings.confidenceThreshold).toBe(initialThreshold)
  })

  it('should handle service factory creation', async () => {
    await serviceRegistry.initialize()

    // Create service factory
    const ocrFactory = serviceRegistry.createFactory('ocrEngine')
    expect(typeof ocrFactory).toBe('function')

    // Use factory
    const ocrEngine = ocrFactory()
    expect(ocrEngine).toBeDefined()
  })

  it('should handle multiple service factories', async () => {
    await serviceRegistry.initialize()

    // Create multiple factories
    const factories = serviceRegistry.createFactories({
      ocr: 'ocrEngine',
      config: 'configManager',
      storage: 'storage'
    })

    expect(factories.ocr).toBeDefined()
    expect(factories.config).toBeDefined()
    expect(factories.storage).toBeDefined()

    // Test factories
    expect(factories.ocr()).toBeDefined()
    expect(factories.config()).toBeDefined()
    expect(factories.storage()).toBeDefined()
  })

  it('should handle service restart', async () => {
    await serviceRegistry.initialize()
    
    // Verify initial state
    expect(serviceRegistry.getStatus().initialized).toBe(true)
    const initialServiceCount = serviceRegistry.getStatus().serviceCount

    // Restart services
    await serviceRegistry.restart()

    // Verify restart
    expect(serviceRegistry.getStatus().initialized).toBe(true)
    expect(serviceRegistry.getStatus().serviceCount).toBe(initialServiceCount)
  })

  it('should handle graceful destruction', async () => {
    await serviceRegistry.initialize()
    expect(serviceRegistry.getStatus().initialized).toBe(true)

    // Destroy services
    await serviceRegistry.destroy()

    // Verify destruction
    expect(serviceRegistry.getStatus().initialized).toBe(false)
    expect(serviceRegistry.getStatus().serviceCount).toBe(0)
  })
})