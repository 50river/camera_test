/**
 * Utility functions for handling file downloads in the browser
 */

export interface DownloadOptions {
  filename: string
  mimeType?: string
}

/**
 * Downloads a Blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  // Clean up the URL object
  URL.revokeObjectURL(url)
}

/**
 * Downloads text content as a file
 */
export const downloadText = (content: string, filename: string, mimeType: string = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(blob, filename)
}

/**
 * Downloads JSON data as a file
 */
export const downloadJSON = (data: any, filename: string): void => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  downloadBlob(blob, filename)
}

/**
 * Downloads CSV data as a file with proper UTF-8 encoding
 */
export const downloadCSV = (csvContent: string, filename: string): void => {
  // Add BOM for proper UTF-8 encoding in Excel
  const bom = '\uFEFF'
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

/**
 * Generates a timestamp-based filename
 */
export const generateTimestampFilename = (baseName: string, extension: string): string => {
  const timestamp = new Date().toISOString().split('T')[0]
  return `${baseName}_${timestamp}.${extension}`
}

/**
 * Validates if a filename is safe for download
 */
export const sanitizeFilename = (filename: string): string => {
  // Remove or replace unsafe characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .toLowerCase()
}