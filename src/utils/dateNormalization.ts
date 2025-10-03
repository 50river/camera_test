export function normalizeJapaneseDate(dateString: string): string {
  // Enhanced Japanese date patterns
  const patterns = [
    // Western calendar: YYYY/MM/DD, YYYY-MM-DD, YYYY年M月D日
    /(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})[日]?/,
    // Japanese era: 令和/平成/昭和/大正
    /(令和|平成|昭和|大正)(\d{1,2})年(\d{1,2})月(\d{1,2})日/,
    // MM/DD/YYYY format
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    // YYYY.MM.DD format
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    // YY.MM.DD format (assume 20XX for YY >= 00)
    /(\d{2})\.(\d{1,2})\.(\d{1,2})/,
    // YYYY年MM月DD日 format
    /(\d{4})年(\d{1,2})月(\d{1,2})日/
  ]

  for (const pattern of patterns) {
    const match = dateString.match(pattern)
    if (match) {
      if (match[1] && isEraName(match[1])) {
        // Convert Japanese era to Western calendar
        return convertEraToWestern(match[1], parseInt(match[2]), parseInt(match[3]), parseInt(match[4]))
      } else if (match[1] && match[2] && match[3]) {
        // Already in Western format
        let year = parseInt(match[1])
        const month = parseInt(match[2])
        const day = parseInt(match[3])
        
        // Handle 2-digit years (assume 20XX)
        if (year < 100) {
          year += 2000
        }
        
        if (year > 31) {
          // YYYY/MM/DD format
          return formatDate(year, month, day)
        } else {
          // MM/DD/YYYY format
          return formatDate(parseInt(match[3]), year, month)
        }
      }
    }
  }

  return dateString // Return original if no pattern matches
}

function isEraName(text: string): boolean {
  return ['令和', '平成', '昭和', '大正'].includes(text)
}

function convertEraToWestern(era: string, year: number, month: number, day: number): string {
  const eraStartYears: { [key: string]: number } = {
    '令和': 2019,
    '平成': 1989,
    '昭和': 1926,
    '大正': 1912
  }

  const westernYear = eraStartYears[era] + year - 1
  return formatDate(westernYear, month, day)
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}/${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && isReasonableReceiptDate(date)
}

function isReasonableReceiptDate(date: Date): boolean {
  const now = new Date()
  const minDate = new Date(1900, 0, 1) // Minimum reasonable date
  const maxDate = new Date(now.getFullYear() + 1, 11, 31) // Maximum 1 year in future
  
  return date >= minDate && date <= maxDate
}

export function parseJapaneseEraYear(eraName: string, eraYear: number): number {
  const eraStartYears: { [key: string]: number } = {
    '令和': 2019,
    '平成': 1989, 
    '昭和': 1926,
    '大正': 1912
  }
  
  const startYear = eraStartYears[eraName]
  if (!startYear) {
    throw new Error(`Unknown era: ${eraName}`)
  }
  
  return startYear + eraYear - 1
}

export function getCurrentJapaneseEra(): { name: string, year: number } {
  const now = new Date()
  const currentYear = now.getFullYear()
  
  // Determine current era based on year
  if (currentYear >= 2019) {
    return { name: '令和', year: currentYear - 2019 + 1 }
  } else if (currentYear >= 1989) {
    return { name: '平成', year: currentYear - 1989 + 1 }
  } else if (currentYear >= 1926) {
    return { name: '昭和', year: currentYear - 1926 + 1 }
  } else {
    return { name: '大正', year: currentYear - 1912 + 1 }
  }
}