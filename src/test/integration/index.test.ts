// Integration test suite entry point
// This file imports all integration tests to ensure they run together

import './e2e-workflow.test'
import './receipt-image.test'
import './browser-compatibility.test'

// Export test utilities for reuse
export * from './test-utils'