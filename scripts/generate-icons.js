// Script to generate placeholder PWA icons
// In a real project, you would use proper icon generation tools

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const iconSizes = [
  16, 32, 72, 96, 128, 144, 152, 192, 384, 512,
  // Microsoft specific sizes
  70, 150, 310
]

const iconsDir = path.join(__dirname, '..', 'public', 'icons')

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Generate SVG icon template
const generateSVGIcon = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#007bff" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.3}" 
        fill="white" text-anchor="middle" dominant-baseline="central" font-weight="bold">
    OCR
  </text>
  <rect x="${size * 0.1}" y="${size * 0.7}" width="${size * 0.8}" height="${size * 0.15}" 
        fill="white" rx="${size * 0.02}"/>
  <rect x="${size * 0.15}" y="${size * 0.75}" width="${size * 0.7}" height="${size * 0.05}" 
        fill="#007bff" rx="${size * 0.01}"/>
</svg>
`.trim()

// Create placeholder icons
iconSizes.forEach(size => {
  const svgContent = generateSVGIcon(size)
  const filename = `icon-${size}x${size}.png`
  const svgFilename = `icon-${size}x${size}.svg`
  
  // Write SVG file (as placeholder)
  fs.writeFileSync(path.join(iconsDir, svgFilename), svgContent)
  
  // Create a simple text file as PNG placeholder
  const pngPlaceholder = `PNG placeholder for ${size}x${size} icon`
  fs.writeFileSync(path.join(iconsDir, filename), pngPlaceholder)
})

// Create special Microsoft icons
const microsoftIcons = [
  { name: 'icon-310x150.png', content: 'Wide tile 310x150 placeholder' },
  { name: 'camera-shortcut.png', content: 'Camera shortcut icon placeholder' },
  { name: 'history-shortcut.png', content: 'History shortcut icon placeholder' }
]

microsoftIcons.forEach(icon => {
  fs.writeFileSync(path.join(iconsDir, icon.name), icon.content)
})

console.log('Generated placeholder icons in public/icons/')
console.log('Note: In production, replace these with actual PNG icons generated from your design.')
console.log('Recommended tools: PWA Builder, Real Favicon Generator, or custom icon generation scripts.')