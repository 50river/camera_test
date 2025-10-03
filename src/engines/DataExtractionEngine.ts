import { OCRResult, FieldResult, ReceiptData, Rectangle } from '../types'
import { normalizeJapaneseDate, isValidDate } from '../utils/dateNormalization'

export interface DataExtractionEngine {
  extractReceiptData(ocrResults: OCRResult[]): ReceiptData
  extractDate(ocrResults: OCRResult[]): FieldResult
  extractPayee(ocrResults: OCRResult[]): FieldResult
  extractAmount(ocrResults: OCRResult[]): FieldResult
  extractUsage(ocrResults: OCRResult[]): FieldResult
  addRegionCandidates(currentData: ReceiptData, regionResults: OCRResult[], fieldType: 'date' | 'payee' | 'amount' | 'usage'): ReceiptData
}

export class ReceiptDataExtractor implements DataExtractionEngine {
  private confidenceThreshold = 0.5
  private maxCandidates = 5

  extractReceiptData(ocrResults: OCRResult[]): ReceiptData {
    // Extract all four fields
    const date = this.extractDate(ocrResults)
    const payee = this.extractPayee(ocrResults)
    const amount = this.extractAmount(ocrResults)
    const usage = this.extractUsage(ocrResults)

    // Generate metadata
    const metadata = {
      processedAt: new Date(),
      imageHash: this.generateImageHash(ocrResults)
    }

    return {
      date,
      payee,
      amount,
      usage,
      metadata
    }
  }

  extractDate(ocrResults: OCRResult[]): FieldResult {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Enhanced date patterns for Japanese receipts
    const datePatterns = [
      // Western calendar formats
      /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})[日]?/g,
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g,
      /(\d{4})\.(\d{1,2})\.(\d{1,2})/g,
      /(\d{2})\.(\d{1,2})\.(\d{1,2})/g, // YY.MM.DD format
      // Japanese era formats (full names)
      /(令和|平成|昭和|大正)(\d{1,2})年(\d{1,2})月(\d{1,2})日/g,
      // Japanese era formats (abbreviated)
      /(R|H|S|T)(\d{1,2})\.(\d{1,2})\.(\d{1,2})/g,
      /(R|H|S|T)(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{1,2})/g,
      // Additional common formats
      /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
      /(\d{1,2})月(\d{1,2})日/g, // Month and day only (current year assumed)
    ]

    for (const result of ocrResults) {
      for (const pattern of datePatterns) {
        pattern.lastIndex = 0 // Reset regex
        let match
        while ((match = pattern.exec(result.text)) !== null) {
          const dateString = match[0]
          const normalizedDate = this.normalizeExtractedDate(dateString)
          
          if (normalizedDate) {
            const confidence = this.calculateDateConfidence(result, dateString, normalizedDate)
            
            candidates.push({
              value: normalizedDate,
              confidence,
              bbox: result.bbox
            })
          }
        }
      }
    }

    return this.selectBestCandidate(candidates, 'date')
  }

  extractPayee(ocrResults: OCRResult[]): FieldResult {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Enhanced business entity suffixes and types common in Japan
    const businessSuffixes = [
      // Corporate entities
      { suffix: '株式会社', boost: 0.4 },
      { suffix: '有限会社', boost: 0.4 },
      { suffix: '合同会社', boost: 0.35 },
      { suffix: '合資会社', boost: 0.35 },
      { suffix: '合名会社', boost: 0.35 },
      // Retail and service
      { suffix: '店', boost: 0.3 },
      { suffix: '商店', boost: 0.3 },
      { suffix: '堂', boost: 0.25 },
      { suffix: 'ストア', boost: 0.25 },
      { suffix: 'マート', boost: 0.25 },
      { suffix: 'ショップ', boost: 0.25 },
      // Food and beverage
      { suffix: 'カフェ', boost: 0.3 },
      { suffix: 'レストラン', boost: 0.3 },
      { suffix: '食堂', boost: 0.25 },
      { suffix: '居酒屋', boost: 0.25 },
      // Healthcare and services
      { suffix: '薬局', boost: 0.3 },
      { suffix: '医院', boost: 0.3 },
      { suffix: 'クリニック', boost: 0.3 },
      { suffix: 'センター', boost: 0.2 },
      { suffix: '病院', boost: 0.3 }
    ]

    // Business prefixes that indicate company names
    const businessPrefixes = [
      '株式会社', '有限会社', '合同会社'
    ]

    for (const result of ocrResults) {
      if (!this.isLikelyPayee(result.text)) {
        continue
      }

      let confidence = this.calculatePayeeConfidence(result, ocrResults, businessSuffixes, businessPrefixes)

      candidates.push({
        value: this.cleanPayeeName(result.text),
        confidence,
        bbox: result.bbox
      })
    }

    // Look for multi-line business names
    const multiLineCandidates = this.extractMultiLinePayees(ocrResults, businessSuffixes)
    candidates.push(...multiLineCandidates)

    return this.selectBestCandidate(candidates, 'payee')
  }

  extractAmount(ocrResults: OCRResult[]): FieldResult {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Enhanced amount patterns for Japanese receipts
    const amountPatterns = [
      // Basic amount patterns
      /¥\s*(\d{1,3}(?:,\d{3})*)/g,
      /(\d{1,3}(?:,\d{3})*)\s*円/g,
      /(\d+)\s*円/g,
      // Labeled amount patterns
      /金額[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /合計[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /税込[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /小計[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /総額[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /お会計[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      /計[：:\s]*¥?\s*(\d{1,3}(?:,\d{3})*)/g,
      // Amount without separators
      /¥\s*(\d+)/g,
      /(\d+)\s*¥/g,
      // Decimal amounts
      /¥?\s*(\d{1,3}(?:,\d{3})*\.\d{2})/g,
      /(\d{1,3}(?:,\d{3})*\.\d{2})\s*円/g
    ]

    // Priority keywords that indicate total amount (ordered by priority)
    const priorityKeywords = [
      { keyword: '合計', boost: 0.4 },
      { keyword: '税込', boost: 0.35 },
      { keyword: 'お会計', boost: 0.3 },
      { keyword: '総額', boost: 0.3 },
      { keyword: '計', boost: 0.25 },
      { keyword: '小計', boost: 0.2 },
      { keyword: '金額', boost: 0.15 }
    ]

    for (const result of ocrResults) {
      for (const pattern of amountPatterns) {
        pattern.lastIndex = 0 // Reset regex
        let match
        while ((match = pattern.exec(result.text)) !== null) {
          const amountString = match[1] || match[0]
          const normalizedAmount = this.normalizeAmount(amountString)
          
          if (normalizedAmount !== null) {
            const confidence = this.calculateAmountConfidence(result, amountString, normalizedAmount, priorityKeywords)
            
            candidates.push({
              value: normalizedAmount.toString(),
              confidence,
              bbox: result.bbox
            })
          }
        }
      }
    }

    return this.selectBestCandidate(candidates, 'amount')
  }

  extractUsage(ocrResults: OCRResult[]): FieldResult {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Enhanced business expense categories and keywords
    const expenseCategories = [
      { category: '会議費', keywords: ['会議', '打合せ', 'ミーティング', '商談'], boost: 0.3 },
      { category: '交通費', keywords: ['交通', '電車', 'バス', 'タクシー', '駐車'], boost: 0.3 },
      { category: '通信費', keywords: ['通信', '電話', 'インターネット', '携帯'], boost: 0.25 },
      { category: '消耗品費', keywords: ['文具', '事務用品', '消耗品', '用紙'], boost: 0.25 },
      { category: '接待費', keywords: ['接待', '懇親', '歓送迎', '宴会'], boost: 0.3 },
      { category: '研修費', keywords: ['研修', '講習', 'セミナー', '勉強会'], boost: 0.25 },
      { category: '飲食代', keywords: ['食事', '飲食', '昼食', '夕食', '朝食', 'ランチ', 'ディナー'], boost: 0.25 }
    ]

    // Extract item lines and analyze them
    const itemCandidates = this.extractItemLines(ocrResults)
    const contextualCandidates = this.analyzeUsageContext(ocrResults, expenseCategories)

    // Process item-based candidates
    for (const item of itemCandidates) {
      const usage = this.categorizeUsage(item.value, expenseCategories)
      if (usage) {
        candidates.push({
          value: usage.category,
          confidence: item.confidence + usage.boost,
          bbox: item.bbox
        })
      }
    }

    // Add contextual candidates
    candidates.push(...contextualCandidates)

    // Generate smart summary if no specific items found
    if (candidates.length === 0) {
      const smartSummary = this.generateSmartUsageSummary(ocrResults, expenseCategories)
      if (smartSummary) {
        candidates.push(smartSummary)
      }
    }

    return this.selectBestCandidate(candidates, 'usage')
  }

  private normalizeExtractedDate(dateString: string): string | null {
    try {
      // Use the existing normalization utility
      const normalized = normalizeJapaneseDate(dateString)
      
      // Validate the normalized date
      if (isValidDate(normalized)) {
        return normalized
      }
      
      // Handle month/day only format (assume current year)
      const monthDayMatch = dateString.match(/(\d{1,2})月(\d{1,2})日/)
      if (monthDayMatch) {
        const currentYear = new Date().getFullYear()
        const month = parseInt(monthDayMatch[1])
        const day = parseInt(monthDayMatch[2])
        const candidate = `${currentYear}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`
        
        if (isValidDate(candidate)) {
          return candidate
        }
      }
      
      // Handle abbreviated era formats
      const eraAbbrevMatch = dateString.match(/(R|H|S|T)(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{1,2})/)
      if (eraAbbrevMatch) {
        const eraMap: { [key: string]: string } = {
          'R': '令和',
          'H': '平成', 
          'S': '昭和',
          'T': '大正'
        }
        
        const fullEra = eraMap[eraAbbrevMatch[1]]
        if (fullEra) {
          const eraYear = parseInt(eraAbbrevMatch[2])
          const month = parseInt(eraAbbrevMatch[3])
          const day = parseInt(eraAbbrevMatch[4])
          const eraDateString = `${fullEra}${eraYear}年${month}月${day}日`
          return normalizeJapaneseDate(eraDateString)
        }
      }
      
      return null
    } catch (error) {
      console.warn('Date normalization failed:', error)
      return null
    }
  }

  private calculateDateConfidence(result: OCRResult, originalDate: string, normalizedDate: string): number {
    let confidence = result.confidence

    // Boost confidence for complete date formats
    if (originalDate.match(/\d{4}[\/\-年]\d{1,2}[\/\-月]\d{1,2}/)) {
      confidence += 0.2
    }

    // Boost confidence for era dates
    if (originalDate.match(/(令和|平成|昭和|大正)/)) {
      confidence += 0.15
    }

    // Boost confidence for abbreviated era formats
    if (originalDate.match(/(R|H|S|T)\d{1,2}/)) {
      confidence += 0.1
    }

    // Validate date is reasonable (not too far in past/future)
    const date = new Date(normalizedDate)
    const now = new Date()
    const yearsDiff = Math.abs(date.getFullYear() - now.getFullYear())
    
    if (yearsDiff <= 5) {
      confidence += 0.1 // Recent dates are more likely
    } else if (yearsDiff > 20) {
      confidence -= 0.2 // Very old dates are less likely for receipts
    }

    // Boost confidence if date is in upper portion of receipt
    if (result.bbox && this.isInUpperRegion(result.bbox, [])) {
      confidence += 0.1
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  private isInUpperRegion(bbox: Rectangle, allResults: OCRResult[]): boolean {
    // Calculate the overall bounding box of all text
    let minY = Infinity
    let maxY = -Infinity

    for (const result of allResults) {
      if (result.bbox) {
        minY = Math.min(minY, result.bbox.y)
        maxY = Math.max(maxY, result.bbox.y + result.bbox.height)
      }
    }

    const totalHeight = maxY - minY
    const upperThreshold = minY + (totalHeight * 0.3) // Top 30%

    return bbox.y <= upperThreshold
  }

  private calculatePayeeConfidence(
    result: OCRResult, 
    allResults: OCRResult[],
    businessSuffixes: Array<{ suffix: string, boost: number }>,
    businessPrefixes: string[]
  ): number {
    let confidence = result.confidence
    const text = result.text.trim()

    // Check for business suffixes
    let suffixBoost = 0
    for (const { suffix, boost } of businessSuffixes) {
      if (text.includes(suffix)) {
        suffixBoost = Math.max(suffixBoost, boost)
      }
    }
    confidence += suffixBoost

    // Check for business prefixes
    for (const prefix of businessPrefixes) {
      if (text.startsWith(prefix)) {
        confidence += 0.3
        break
      }
    }

    // Prioritize text in upper region of receipt (top 40%)
    if (result.bbox && this.isInUpperRegion(result.bbox, allResults)) {
      confidence += 0.25
    }

    // Boost confidence for appropriate length business names
    if (text.length >= 3 && text.length <= 30) {
      confidence += 0.15
    } else if (text.length > 30) {
      confidence -= 0.1 // Very long text is less likely to be a business name
    }

    // Boost confidence for text that looks like a proper business name
    if (this.looksLikeBusinessName(text)) {
      confidence += 0.2
    }

    // Penalize text that contains obvious non-business content
    if (this.containsNonBusinessContent(text)) {
      confidence -= 0.3
    }

    // Boost confidence for text in larger font (if we can infer from bbox size)
    if (result.bbox && this.isLargerText(result.bbox, allResults)) {
      confidence += 0.1
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  private cleanPayeeName(text: string): string {
    // Clean up the payee name
    return text
      .trim()
      .replace(/^[：:\s]+/, '') // Remove leading colons/spaces
      .replace(/[：:\s]+$/, '') // Remove trailing colons/spaces
      .replace(/\s+/g, ' ')     // Normalize whitespace
  }

  private extractMultiLinePayees(
    ocrResults: OCRResult[],
    businessSuffixes: Array<{ suffix: string, boost: number }>
  ): Array<{ value: string, confidence: number, bbox?: Rectangle }> {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Sort results by Y position to find adjacent lines
    const sortedResults = [...ocrResults]
      .filter(r => r.bbox)
      .sort((a, b) => a.bbox!.y - b.bbox!.y)

    for (let i = 0; i < sortedResults.length - 1; i++) {
      const current = sortedResults[i]
      const next = sortedResults[i + 1]

      // Check if lines are vertically adjacent
      if (this.areVerticallyAdjacent(current.bbox!, next.bbox!)) {
        const combinedText = `${current.text.trim()} ${next.text.trim()}`
        
        // Check if combined text looks like a business name
        let hasSuffix = false
        for (const { suffix } of businessSuffixes) {
          if (combinedText.includes(suffix)) {
            hasSuffix = true
            break
          }
        }

        if (hasSuffix && this.looksLikeBusinessName(combinedText)) {
          const combinedBbox = this.combineBoundingBoxes(current.bbox!, next.bbox!)
          const confidence = Math.min(current.confidence, next.confidence) + 0.2 // Boost for multi-line

          candidates.push({
            value: this.cleanPayeeName(combinedText),
            confidence,
            bbox: combinedBbox
          })
        }
      }
    }

    return candidates
  }

  private looksLikeBusinessName(text: string): boolean {
    // Check if text looks like a legitimate business name
    
    // Must contain some Japanese characters or proper business terms
    const hasJapanese = /[ひらがなカタカナ漢字]/.test(text)
    const hasBusinessTerms = /[株式会社有限合同店舗商堂局院]/.test(text)
    
    if (!hasJapanese && !hasBusinessTerms) {
      return false
    }

    // Should not be mostly numbers
    const numberRatio = (text.match(/\d/g) || []).length / text.length
    if (numberRatio > 0.5) {
      return false
    }

    return true
  }

  private containsNonBusinessContent(text: string): boolean {
    // Check for content that indicates this is not a business name
    const nonBusinessPatterns = [
      /領収書|レシート|receipt/i,
      /合計|税込|小計|金額/,
      /\d{4}[\/\-年]\d{1,2}[\/\-月]/,  // Date patterns
      /¥\d+|円\d+/,                    // Amount patterns
      /ありがとうございました/,
      /またお越しください/
    ]

    for (const pattern of nonBusinessPatterns) {
      if (pattern.test(text)) {
        return true
      }
    }

    return false
  }

  private isLargerText(bbox: Rectangle, allResults: OCRResult[]): boolean {
    // Estimate if this text is larger than average based on bounding box height
    const heights = allResults
      .filter(r => r.bbox)
      .map(r => r.bbox!.height)

    if (heights.length === 0) return false

    const averageHeight = heights.reduce((sum, h) => sum + h, 0) / heights.length
    return bbox.height > averageHeight * 1.2 // 20% larger than average
  }

  private areVerticallyAdjacent(bbox1: Rectangle, bbox2: Rectangle): boolean {
    // Check if two bounding boxes are vertically adjacent (one below the other)
    const verticalGap = Math.abs((bbox1.y + bbox1.height) - bbox2.y)
    const maxGap = Math.max(bbox1.height, bbox2.height) * 0.5 // Allow some gap

    // Also check horizontal overlap
    const horizontalOverlap = Math.min(bbox1.x + bbox1.width, bbox2.x + bbox2.width) - 
                             Math.max(bbox1.x, bbox2.x)

    return verticalGap <= maxGap && horizontalOverlap > 0
  }

  private combineBoundingBoxes(bbox1: Rectangle, bbox2: Rectangle): Rectangle {
    const x = Math.min(bbox1.x, bbox2.x)
    const y = Math.min(bbox1.y, bbox2.y)
    const right = Math.max(bbox1.x + bbox1.width, bbox2.x + bbox2.width)
    const bottom = Math.max(bbox1.y + bbox1.height, bbox2.y + bbox2.height)

    return {
      x,
      y,
      width: right - x,
      height: bottom - y
    }
  }

  private isLikelyPayee(text: string): boolean {
    // Filter out obvious non-payee text
    const excludePatterns = [
      /^\d+$/,           // Pure numbers
      /^¥?\d+円?$/,      // Amounts
      /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/, // Dates
      /^[：:]\s*$/,      // Colons/separators
      /^[\s\-_]+$/,      // Whitespace/separators
      /^[a-zA-Z]+$/      // Pure English (unless it's a known business type)
    ]

    const text_trimmed = text.trim()

    for (const pattern of excludePatterns) {
      if (pattern.test(text_trimmed)) {
        return false
      }
    }

    // Must be at least 2 characters
    if (text_trimmed.length < 2) {
      return false
    }

    // Should contain some meaningful content
    return /[ひらがなカタカナ漢字a-zA-Z]/.test(text_trimmed)
  }

  private extractItemLines(ocrResults: OCRResult[]): Array<{ value: string, confidence: number, bbox?: Rectangle }> {
    const items: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Find middle region of receipt (likely contains item details)
    const sortedByY = [...ocrResults].sort((a, b) => {
      if (!a.bbox || !b.bbox) return 0
      return a.bbox.y - b.bbox.y
    })

    const middleStart = Math.floor(sortedByY.length * 0.2)
    const middleEnd = Math.floor(sortedByY.length * 0.8)
    const middleResults = sortedByY.slice(middleStart, middleEnd)

    for (const result of middleResults) {
      // Skip if looks like amount or date
      if (result.text.match(/^¥?\d+円?$/) || result.text.match(/\d{4}[\/\-]\d{1,2}/)) {
        continue
      }

      // Skip very short text
      if (result.text.trim().length < 2) {
        continue
      }

      items.push({
        value: result.text.trim(),
        confidence: result.confidence,
        bbox: result.bbox
      })
    }

    return items
  }

  private categorizeUsage(
    text: string, 
    expenseCategories: Array<{ category: string, keywords: string[], boost: number }>
  ): { category: string, boost: number } | null {
    const lowerText = text.toLowerCase()

    // Find the best matching category
    let bestMatch: { category: string, boost: number } | null = null
    let maxMatches = 0

    for (const { category, keywords, boost } of expenseCategories) {
      let matches = 0
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matches++
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches
        bestMatch = { category, boost }
      }
    }

    return bestMatch
  }

  private analyzeUsageContext(
    ocrResults: OCRResult[],
    expenseCategories: Array<{ category: string, keywords: string[], boost: number }>
  ): Array<{ value: string, confidence: number, bbox?: Rectangle }> {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Analyze business type from payee information
    const businessTypeUsage = this.inferUsageFromBusinessType(ocrResults)
    if (businessTypeUsage) {
      candidates.push(businessTypeUsage)
    }

    // Look for explicit usage indicators
    const explicitUsage = this.findExplicitUsageIndicators(ocrResults, expenseCategories)
    candidates.push(...explicitUsage)

    return candidates
  }

  private inferUsageFromBusinessType(ocrResults: OCRResult[]): { value: string, confidence: number, bbox?: Rectangle } | null {
    // Infer usage category based on business type
    const businessTypeMap = [
      { patterns: ['レストラン', 'カフェ', '食堂', '居酒屋', 'バー'], usage: '飲食代' },
      { patterns: ['ホテル', '旅館', '宿泊'], usage: '宿泊費' },
      { patterns: ['書店', '本屋', '図書'], usage: '書籍代' },
      { patterns: ['文具', '事務用品', 'オフィス'], usage: '消耗品費' },
      { patterns: ['薬局', 'ドラッグ'], usage: '医療費' },
      { patterns: ['ガソリン', 'スタンド', '燃料'], usage: '交通費' },
      { patterns: ['コンビニ', 'スーパー'], usage: '雑費' }
    ]

    for (const result of ocrResults) {
      for (const { patterns, usage } of businessTypeMap) {
        for (const pattern of patterns) {
          if (result.text.includes(pattern)) {
            return {
              value: usage,
              confidence: result.confidence + 0.2,
              bbox: result.bbox
            }
          }
        }
      }
    }

    return null
  }

  private findExplicitUsageIndicators(
    ocrResults: OCRResult[],
    expenseCategories: Array<{ category: string, keywords: string[], boost: number }>
  ): Array<{ value: string, confidence: number, bbox?: Rectangle }> {
    const candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    // Look for explicit usage patterns like "用途：会議費" or "目的：研修"
    const usagePatterns = [
      /用途[：:\s]*([^：:\s\n]+)/,
      /目的[：:\s]*([^：:\s\n]+)/,
      /利用内容[：:\s]*([^：:\s\n]+)/,
      /適用[：:\s]*([^：:\s\n]+)/
    ]

    for (const result of ocrResults) {
      for (const pattern of usagePatterns) {
        const match = result.text.match(pattern)
        if (match && match[1]) {
          const usage = match[1].trim()
          const categorized = this.categorizeUsage(usage, expenseCategories)
          
          candidates.push({
            value: categorized ? categorized.category : usage,
            confidence: result.confidence + 0.3, // High confidence for explicit indicators
            bbox: result.bbox
          })
        }
      }
    }

    return candidates
  }

  private generateSmartUsageSummary(
    ocrResults: OCRResult[],
    expenseCategories: Array<{ category: string, keywords: string[], boost: number }>
  ): { value: string, confidence: number, bbox?: Rectangle } | null {
    // Analyze all text to determine most likely usage category
    const allText = ocrResults.map(r => r.text).join(' ').toLowerCase()

    // Count keyword occurrences for each category
    const categoryScores: { [category: string]: number } = {}

    for (const { category, keywords } of expenseCategories) {
      let score = 0
      for (const keyword of keywords) {
        const occurrences = (allText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
        score += occurrences
      }
      if (score > 0) {
        categoryScores[category] = score
      }
    }

    // Find the category with the highest score
    let bestCategory = ''
    let bestScore = 0

    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > bestScore) {
        bestScore = score
        bestCategory = category
      }
    }

    if (bestCategory) {
      return {
        value: bestCategory,
        confidence: 0.4 + (bestScore * 0.1), // Base confidence + score bonus
        bbox: undefined
      }
    }

    // Fallback to generic categories based on common patterns
    if (allText.includes('食') || allText.includes('飲') || allText.includes('レストラン')) {
      return { value: '飲食代', confidence: 0.3, bbox: undefined }
    }

    if (allText.includes('交通') || allText.includes('電車') || allText.includes('バス')) {
      return { value: '交通費', confidence: 0.3, bbox: undefined }
    }

    // Final fallback
    return { value: '雑費', confidence: 0.2, bbox: undefined }
  }

  private generateUsageSummary(ocrResults: OCRResult[]): string {
    // Legacy method - kept for backward compatibility
    const words = ocrResults
      .map(r => r.text.trim())
      .filter(text => text.length >= 2)
      .filter(text => !text.match(/^\d+$|^¥?\d+円?$|^\d{4}[\/\-]/))
      .slice(0, 3)

    if (words.length === 0) {
      return '飲食代'
    }

    return words.join('・')
  }

  private selectBestCandidate(
    candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }>,
    fieldType: string
  ): FieldResult {
    if (candidates.length === 0) {
      return {
        value: '',
        confidence: 0,
        candidates: []
      }
    }

    // Sort by confidence (highest first)
    candidates.sort((a, b) => b.confidence - a.confidence)

    // Remove duplicates while preserving order
    const uniqueCandidates = this.removeDuplicates(candidates)

    // Take top candidates up to maxCandidates
    const topCandidates = uniqueCandidates.slice(0, this.maxCandidates)

    const best = topCandidates[0]
    const candidateValues = topCandidates.map(c => c.value)

    return {
      value: best.value,
      confidence: best.confidence,
      candidates: candidateValues,
      bbox: best.bbox
    }
  }

  private removeDuplicates(
    candidates: Array<{ value: string, confidence: number, bbox?: Rectangle }>
  ): Array<{ value: string, confidence: number, bbox?: Rectangle }> {
    const seen = new Set<string>()
    const unique: Array<{ value: string, confidence: number, bbox?: Rectangle }> = []

    for (const candidate of candidates) {
      const normalizedValue = candidate.value.toLowerCase().trim()
      if (!seen.has(normalizedValue)) {
        seen.add(normalizedValue)
        unique.push(candidate)
      }
    }

    return unique
  }

  private normalizeAmount(amountString: string): number | null {
    try {
      // Remove currency symbols and whitespace
      let cleaned = amountString
        .replace(/[¥円]/g, '')
        .replace(/\s+/g, '')
        .trim()

      // Handle decimal amounts
      if (cleaned.includes('.')) {
        const numericValue = parseFloat(cleaned.replace(/,/g, ''))
        if (!isNaN(numericValue) && numericValue > 0) {
          return Math.round(numericValue) // Round to nearest integer for receipts
        }
      }

      // Handle integer amounts with commas
      cleaned = cleaned.replace(/,/g, '')
      const numericValue = parseInt(cleaned, 10)

      if (isNaN(numericValue) || numericValue <= 0) {
        return null
      }

      // Validate reasonable amount range for receipts
      if (numericValue < 1 || numericValue > 10000000) { // 1 yen to 10 million yen
        return null
      }

      return numericValue
    } catch (error) {
      return null
    }
  }

  private calculateAmountConfidence(
    result: OCRResult, 
    originalAmount: string, 
    normalizedAmount: number,
    priorityKeywords: Array<{ keyword: string, boost: number }>
  ): number {
    let confidence = result.confidence

    // Boost confidence for priority keywords
    let keywordBoost = 0
    for (const { keyword, boost } of priorityKeywords) {
      if (result.text.includes(keyword)) {
        keywordBoost = Math.max(keywordBoost, boost)
      }
    }
    confidence += keywordBoost

    // Boost confidence for properly formatted amounts
    if (originalAmount.includes(',')) {
      confidence += 0.1 // Comma-separated amounts are more likely to be totals
    }

    if (originalAmount.includes('¥') || originalAmount.includes('円')) {
      confidence += 0.1 // Currency symbols indicate amounts
    }

    // Validate amount is reasonable for receipts
    if (normalizedAmount >= 100 && normalizedAmount <= 100000) {
      confidence += 0.15 // Common receipt amount range
    } else if (normalizedAmount >= 10 && normalizedAmount <= 1000000) {
      confidence += 0.05 // Acceptable range
    } else {
      confidence -= 0.2 // Unusual amounts are less likely
    }

    // Boost confidence if amount appears in lower portion of receipt
    if (result.bbox && this.isInLowerRegion(result.bbox, [])) {
      confidence += 0.1 // Totals usually appear at bottom
    }

    // Penalize very small amounts that might be item codes or quantities
    if (normalizedAmount < 10) {
      confidence -= 0.3
    }

    // Boost confidence for round numbers (likely totals)
    if (normalizedAmount % 100 === 0 || normalizedAmount % 50 === 0) {
      confidence += 0.05
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  private isInLowerRegion(bbox: Rectangle, allResults: OCRResult[]): boolean {
    // Calculate the overall bounding box of all text
    let minY = Infinity
    let maxY = -Infinity

    for (const result of allResults) {
      if (result.bbox) {
        minY = Math.min(minY, result.bbox.y)
        maxY = Math.max(maxY, result.bbox.y + result.bbox.height)
      }
    }

    const totalHeight = maxY - minY
    const lowerThreshold = minY + (totalHeight * 0.7) // Bottom 30%

    return bbox.y >= lowerThreshold
  }

  private generateImageHash(ocrResults: OCRResult[]): string {
    // Generate a simple hash based on OCR results for tracking
    const textContent = ocrResults.map(r => r.text).join('')
    let hash = 0
    for (let i = 0; i < textContent.length; i++) {
      const char = textContent.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  // Configuration methods
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold))
  }

  setMaxCandidates(max: number): void {
    this.maxCandidates = Math.max(1, max)
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold
  }

  getMaxCandidates(): number {
    return this.maxCandidates
  }

  addRegionCandidates(
    currentData: ReceiptData, 
    regionResults: OCRResult[], 
    fieldType: 'date' | 'payee' | 'amount' | 'usage'
  ): ReceiptData {
    // Extract candidates from region OCR results based on field type
    let newFieldResult: FieldResult

    switch (fieldType) {
      case 'date':
        newFieldResult = this.extractDate(regionResults)
        break
      case 'payee':
        newFieldResult = this.extractPayee(regionResults)
        break
      case 'amount':
        newFieldResult = this.extractAmount(regionResults)
        break
      case 'usage':
        newFieldResult = this.extractUsage(regionResults)
        break
      default:
        return currentData
    }

    // Merge new candidates with existing ones
    const currentField = currentData[fieldType]
    const mergedCandidates = this.mergeCandidates(currentField.candidates, newFieldResult.candidates)
    
    // Update the field with new candidates and potentially better value
    const updatedField: FieldResult = {
      value: newFieldResult.confidence > currentField.confidence ? newFieldResult.value : currentField.value,
      confidence: Math.max(newFieldResult.confidence, currentField.confidence),
      candidates: mergedCandidates,
      bbox: newFieldResult.confidence > currentField.confidence ? newFieldResult.bbox : currentField.bbox
    }

    // Return updated receipt data
    return {
      ...currentData,
      [fieldType]: updatedField,
      metadata: {
        ...currentData.metadata,
        processedAt: new Date() // Update processing timestamp
      }
    }
  }

  private mergeCandidates(existingCandidates: string[], newCandidates: string[]): string[] {
    // Combine and deduplicate candidates, preserving order by relevance
    const allCandidates = [...existingCandidates, ...newCandidates]
    const uniqueCandidates: string[] = []
    const seen = new Set<string>()

    for (const candidate of allCandidates) {
      const normalized = candidate.toLowerCase().trim()
      if (!seen.has(normalized) && candidate.trim().length > 0) {
        seen.add(normalized)
        uniqueCandidates.push(candidate)
      }
    }

    // Limit to maximum number of candidates
    return uniqueCandidates.slice(0, this.maxCandidates)
  }
}