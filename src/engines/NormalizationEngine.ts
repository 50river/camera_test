import { normalizeJapaneseDate, isValidDate } from '../utils/dateNormalization'

export interface NormalizationEngine {
  normalizeDate(dateString: string): string
  normalizeAmount(amountString: string): number
  normalizePayee(payeeString: string): string
  normalizeUsage(usageString: string): string
}

export class ReceiptNormalizationEngine implements NormalizationEngine {
  
  normalizeDate(dateString: string): string {
    try {
      // Use the existing date normalization utility
      const normalized = normalizeJapaneseDate(dateString)
      
      // Validate the result
      if (isValidDate(normalized)) {
        return normalized
      }
      
      // If normalization failed, return original
      return dateString
    } catch (error) {
      console.warn('Date normalization failed:', error)
      return dateString
    }
  }

  normalizeAmount(amountString: string): number {
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
        return 0
      }

      // Validate reasonable amount range
      if (numericValue < 1 || numericValue > 10000000) {
        return 0
      }

      return numericValue
    } catch (error) {
      console.warn('Amount normalization failed:', error)
      return 0
    }
  }

  normalizePayee(payeeString: string): string {
    try {
      let normalized = payeeString.trim()

      // Remove common prefixes/suffixes that might be OCR artifacts
      normalized = normalized
        .replace(/^[：:\s\-_]+/, '') // Remove leading separators
        .replace(/[：:\s\-_]+$/, '') // Remove trailing separators
        .replace(/\s+/g, ' ')        // Normalize whitespace

      // Handle common OCR errors in Japanese business names
      normalized = this.fixCommonOCRErrors(normalized)

      // Standardize business entity formats
      normalized = this.standardizeBusinessEntity(normalized)

      return normalized
    } catch (error) {
      console.warn('Payee normalization failed:', error)
      return payeeString
    }
  }

  normalizeUsage(usageString: string): string {
    try {
      let normalized = usageString.trim()

      // Standardize common expense categories
      normalized = this.standardizeExpenseCategory(normalized)

      // Clean up formatting
      normalized = normalized
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .replace(/^[：:\s]+/, '')    // Remove leading separators
        .replace(/[：:\s]+$/, '')    // Remove trailing separators

      // Ensure it's not empty
      if (!normalized) {
        normalized = '雑費' // Default to miscellaneous expenses
      }

      return normalized
    } catch (error) {
      console.warn('Usage normalization failed:', error)
      return usageString || '雑費'
    }
  }

  private fixCommonOCRErrors(text: string): string {
    // Common OCR misreadings in Japanese text
    const ocrFixes = [
      // Common character confusions
      { from: /ロ/g, to: '口' },      // ロ (katakana) vs 口 (kanji)
      { from: /力/g, to: 'カ' },      // 力 (kanji) vs カ (katakana) in some contexts
      { from: /工/g, to: 'エ' },      // 工 (kanji) vs エ (katakana) in some contexts
      
      // Common business name fixes
      { from: /株式會社/g, to: '株式会社' },
      { from: /有限會社/g, to: '有限会社' },
      
      // Number/letter confusions
      { from: /０/g, to: '0' },
      { from: /１/g, to: '1' },
      { from: /２/g, to: '2' },
      { from: /３/g, to: '3' },
      { from: /４/g, to: '4' },
      { from: /５/g, to: '5' },
      { from: /６/g, to: '6' },
      { from: /７/g, to: '7' },
      { from: /８/g, to: '8' },
      { from: /９/g, to: '9' }
    ]

    let fixed = text
    for (const { from, to } of ocrFixes) {
      fixed = fixed.replace(from, to)
    }

    return fixed
  }

  private standardizeBusinessEntity(text: string): string {
    // Standardize business entity formats
    const entityStandardizations = [
      // Corporate entities
      { pattern: /株式会社(.+)/, replacement: '株式会社$1' },
      { pattern: /(.+)株式会社/, replacement: '株式会社$1' },
      { pattern: /有限会社(.+)/, replacement: '有限会社$1' },
      { pattern: /(.+)有限会社/, replacement: '有限会社$1' },
      { pattern: /合同会社(.+)/, replacement: '合同会社$1' },
      { pattern: /(.+)合同会社/, replacement: '合同会社$1' },
      
      // Standardize spacing around business entities
      { pattern: /株式会社\s+/, replacement: '株式会社' },
      { pattern: /\s+株式会社/, replacement: '株式会社' },
      { pattern: /有限会社\s+/, replacement: '有限会社' },
      { pattern: /\s+有限会社/, replacement: '有限会社' }
    ]

    let standardized = text
    for (const { pattern, replacement } of entityStandardizations) {
      standardized = standardized.replace(pattern, replacement)
    }

    return standardized
  }

  private standardizeExpenseCategory(text: string): string {
    // Standardize expense category names
    const categoryStandardizations = [
      // Meeting and conference expenses
      { patterns: ['会議', '打合せ', 'ミーティング', '商談', '打ち合わせ'], standard: '会議費' },
      
      // Transportation expenses
      { patterns: ['交通', '電車', 'バス', 'タクシー', '駐車', '燃料', 'ガソリン'], standard: '交通費' },
      
      // Communication expenses
      { patterns: ['通信', '電話', 'インターネット', '携帯', '郵送'], standard: '通信費' },
      
      // Office supplies
      { patterns: ['文具', '事務用品', '消耗品', '用紙', 'ペン', '鉛筆'], standard: '消耗品費' },
      
      // Entertainment expenses
      { patterns: ['接待', '懇親', '歓送迎', '宴会', 'パーティー'], standard: '接待費' },
      
      // Training expenses
      { patterns: ['研修', '講習', 'セミナー', '勉強会', '教育'], standard: '研修費' },
      
      // Food and beverage
      { patterns: ['食事', '飲食', '昼食', '夕食', '朝食', 'ランチ', 'ディナー', '弁当'], standard: '飲食代' },
      
      // Accommodation
      { patterns: ['宿泊', 'ホテル', '旅館', '民宿'], standard: '宿泊費' },
      
      // Books and materials
      { patterns: ['書籍', '本', '雑誌', '新聞', '資料'], standard: '書籍代' },
      
      // Medical expenses
      { patterns: ['医療', '薬', '病院', '診察', '治療'], standard: '医療費' }
    ]

    const lowerText = text.toLowerCase()

    for (const { patterns, standard } of categoryStandardizations) {
      for (const pattern of patterns) {
        if (lowerText.includes(pattern.toLowerCase())) {
          return standard
        }
      }
    }

    // If no standardization found, return cleaned original
    return text
  }

  // Utility methods for validation
  isValidNormalizedDate(dateString: string): boolean {
    return isValidDate(dateString)
  }

  isValidNormalizedAmount(amount: number): boolean {
    return !isNaN(amount) && amount > 0 && amount <= 10000000
  }

  isValidNormalizedPayee(payee: string): boolean {
    const trimmed = payee.trim()
    return trimmed.length >= 2 && trimmed.length <= 100
  }

  isValidNormalizedUsage(usage: string): boolean {
    const trimmed = usage.trim()
    return trimmed.length >= 1 && trimmed.length <= 50
  }
}