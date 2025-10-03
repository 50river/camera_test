#!/usr/bin/env node

// Production build script with optimizations
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.join(__dirname, '..')

console.log('🚀 Starting production build...')

// Step 1: Clean previous build
console.log('🧹 Cleaning previous build...')
try {
  if (fs.existsSync(path.join(rootDir, 'dist'))) {
    fs.rmSync(path.join(rootDir, 'dist'), { recursive: true, force: true })
  }
  console.log('✅ Previous build cleaned')
} catch (error) {
  console.warn('⚠️  Warning: Could not clean previous build:', error.message)
}

// Step 2: Type check
console.log('🔍 Running type check...')
try {
  execSync('npm run type-check', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Type check passed')
} catch (error) {
  console.error('❌ Type check failed')
  process.exit(1)
}

// Step 3: Run tests
console.log('🧪 Running tests...')
try {
  execSync('npm test', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Tests passed')
} catch (error) {
  console.error('❌ Tests failed')
  process.exit(1)
}

// Step 4: Build application
console.log('🔨 Building application...')
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' })
  console.log('✅ Application built successfully')
} catch (error) {
  console.error('❌ Build failed')
  process.exit(1)
}

// Step 5: Analyze bundle size
console.log('📊 Analyzing bundle size...')
try {
  const distDir = path.join(rootDir, 'dist')
  const stats = analyzeBundleSize(distDir)
  
  console.log('\n📦 Bundle Analysis:')
  console.log(`Total size: ${formatBytes(stats.totalSize)}`)
  console.log(`JavaScript: ${formatBytes(stats.jsSize)} (${stats.jsFiles} files)`)
  console.log(`CSS: ${formatBytes(stats.cssSize)} (${stats.cssFiles} files)`)
  console.log(`Assets: ${formatBytes(stats.assetSize)} (${stats.assetFiles} files)`)
  
  // Check for large files
  if (stats.largeFiles.length > 0) {
    console.log('\n⚠️  Large files detected:')
    stats.largeFiles.forEach(file => {
      console.log(`  ${file.name}: ${formatBytes(file.size)}`)
    })
  }
  
} catch (error) {
  console.warn('⚠️  Warning: Could not analyze bundle size:', error.message)
}

// Step 6: Validate PWA requirements
console.log('🔍 Validating PWA requirements...')
try {
  validatePWA(path.join(rootDir, 'dist'))
  console.log('✅ PWA validation passed')
} catch (error) {
  console.warn('⚠️  PWA validation warning:', error.message)
}

// Step 7: Generate build report
console.log('📋 Generating build report...')
try {
  generateBuildReport(rootDir)
  console.log('✅ Build report generated')
} catch (error) {
  console.warn('⚠️  Warning: Could not generate build report:', error.message)
}

console.log('\n🎉 Production build completed successfully!')
console.log('📁 Build output: ./dist/')
console.log('🌐 Ready for deployment')

// Helper functions
function analyzeBundleSize(distDir) {
  const stats = {
    totalSize: 0,
    jsSize: 0,
    cssSize: 0,
    assetSize: 0,
    jsFiles: 0,
    cssFiles: 0,
    assetFiles: 0,
    largeFiles: []
  }
  
  function analyzeDirectory(dir) {
    const files = fs.readdirSync(dir)
    
    files.forEach(file => {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        analyzeDirectory(filePath)
      } else {
        const size = stat.size
        stats.totalSize += size
        
        if (file.endsWith('.js')) {
          stats.jsSize += size
          stats.jsFiles++
        } else if (file.endsWith('.css')) {
          stats.cssSize += size
          stats.cssFiles++
        } else {
          stats.assetSize += size
          stats.assetFiles++
        }
        
        // Flag large files (>500KB)
        if (size > 500 * 1024) {
          stats.largeFiles.push({
            name: path.relative(distDir, filePath),
            size
          })
        }
      }
    })
  }
  
  analyzeDirectory(distDir)
  return stats
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function validatePWA(distDir) {
  const requiredFiles = [
    'manifest.json',
    'sw.js',
    'index.html'
  ]
  
  const missingFiles = requiredFiles.filter(file => {
    return !fs.existsSync(path.join(distDir, file))
  })
  
  if (missingFiles.length > 0) {
    throw new Error(`Missing PWA files: ${missingFiles.join(', ')}`)
  }
  
  // Validate manifest.json
  const manifestPath = path.join(distDir, 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  
  const requiredManifestFields = ['name', 'short_name', 'start_url', 'display', 'icons']
  const missingFields = requiredManifestFields.filter(field => !manifest[field])
  
  if (missingFields.length > 0) {
    throw new Error(`Missing manifest fields: ${missingFields.join(', ')}`)
  }
  
  // Check for at least one 192x192 and one 512x512 icon
  const icons = manifest.icons || []
  const has192 = icons.some(icon => icon.sizes.includes('192x192'))
  const has512 = icons.some(icon => icon.sizes.includes('512x512'))
  
  if (!has192 || !has512) {
    throw new Error('Manifest must include 192x192 and 512x512 icons')
  }
}

function generateBuildReport(rootDir) {
  const report = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    buildEnvironment: process.env.NODE_ENV || 'production',
    gitCommit: getGitCommit(),
    buildSize: analyzeBundleSize(path.join(rootDir, 'dist'))
  }
  
  const reportPath = path.join(rootDir, 'dist', 'build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
}

function getGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}