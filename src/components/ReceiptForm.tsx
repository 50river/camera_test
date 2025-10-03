import React, { useState } from 'react'
import { ReceiptData, FieldResult } from '../types'
import { useNotifications } from './NotificationCenter'
import { errorHandler } from '../utils/errorHandler'

interface ReceiptFormProps {
  receiptData: ReceiptData | null
  onDataChange: (data: ReceiptData) => void
  onSave: () => void
}

interface FieldState {
  showCandidates: boolean
}

export const ReceiptForm: React.FC<ReceiptFormProps> = ({ 
  receiptData, 
  onDataChange, 
  onSave 
}) => {
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({
    date: { showCandidates: false },
    payee: { showCandidates: false },
    amount: { showCandidates: false },
    usage: { showCandidates: false }
  })
  const notifications = useNotifications()

  const updateFieldValue = (fieldName: keyof ReceiptData, newValue: string) => {
    if (!receiptData) return

    // Validate field values
    try {
      validateFieldValue(fieldName, newValue)
      
      const updatedData = {
        ...receiptData,
        [fieldName]: {
          ...receiptData[fieldName],
          value: newValue
        }
      }
      onDataChange(updatedData)
    } catch (error) {
      const appError = errorHandler.handleError(error as Error, {
        component: 'ReceiptForm',
        operation: 'field_update',
        metadata: { 
          fieldName,
          newValue,
          focusField: () => {
            const input = document.querySelector(`input[data-field="${fieldName}"]`) as HTMLInputElement
            input?.focus()
          }
        }
      })
      
      notifications.showWarning(
        '入力エラー',
        errorHandler.getLocalizedMessage(appError),
        5000
      )
    }
  }

  const validateFieldValue = (fieldName: keyof ReceiptData, value: string) => {
    if (fieldName === 'amount' && value) {
      const numericValue = value.replace(/[^\d]/g, '')
      if (numericValue && (isNaN(Number(numericValue)) || Number(numericValue) < 0)) {
        throw errorHandler.createUserError(
          'INVALID_FIELD_VALUE',
          '金額は正の数値で入力してください'
        )
      }
    }
    
    if (fieldName === 'date' && value) {
      const datePattern = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/
      if (!datePattern.test(value)) {
        throw errorHandler.createUserError(
          'INVALID_FIELD_VALUE',
          '日付はYYYY/MM/DD形式で入力してください'
        )
      }
    }
  }

  const selectCandidate = (fieldName: keyof ReceiptData, candidate: string) => {
    updateFieldValue(fieldName, candidate)
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: { showCandidates: false }
    }))
    
    notifications.showInfo(
      '候補を選択',
      `${fieldName}に「${candidate}」を設定しました`,
      2000
    )
  }

  const toggleCandidates = (fieldName: string) => {
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: { showCandidates: !prev[fieldName]?.showCandidates }
    }))
  }

  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence >= 0.8) return 'high'
    if (confidence >= 0.6) return 'medium'
    return 'low'
  }

  const getConfidenceColor = (confidence: number): string => {
    const level = getConfidenceLevel(confidence)
    switch (level) {
      case 'high': return '#28a745'
      case 'medium': return '#ffc107'
      case 'low': return '#dc3545'
    }
  }

  const renderField = (
    fieldName: keyof ReceiptData,
    label: string,
    fieldData: FieldResult,
    placeholder?: string
  ) => {
    const hasLowConfidence = fieldData.confidence < 0.8
    const hasCandidates = fieldData.candidates && fieldData.candidates.length > 0
    const confidenceLevel = getConfidenceLevel(fieldData.confidence)

    return (
      <div className="form-field">
        <div className="field-header">
          <label className="field-label">{label}</label>
          <div className="field-indicators">
            {fieldData.confidence > 0 && (
              <div 
                className={`confidence-indicator confidence-${confidenceLevel}`}
                title={`信頼度: ${Math.round(fieldData.confidence * 100)}%`}
              >
                <div 
                  className="confidence-bar"
                  style={{ 
                    width: `${fieldData.confidence * 100}%`,
                    backgroundColor: getConfidenceColor(fieldData.confidence)
                  }}
                />
                <span className="confidence-text">
                  {Math.round(fieldData.confidence * 100)}%
                </span>
              </div>
            )}
            {hasCandidates && (
              <button
                type="button"
                className="candidates-toggle"
                onClick={() => toggleCandidates(fieldName)}
                title="候補を表示"
              >
                📋 候補 ({fieldData.candidates.length})
              </button>
            )}
          </div>
        </div>

        <div className="field-input-container">
          <input
            type="text"
            className={`field-input ${hasLowConfidence ? 'low-confidence' : ''}`}
            value={fieldData.value || ''}
            onChange={(e) => updateFieldValue(fieldName, e.target.value)}
            placeholder={placeholder}
            data-field={fieldName}
          />
          
          {hasLowConfidence && (
            <div className="warning-message">
              ⚠️ 信頼度が低いため、内容を確認してください
            </div>
          )}
        </div>

        {fieldStates[fieldName]?.showCandidates && hasCandidates && (
          <div className="candidates-dropdown">
            <div className="candidates-header">
              <span>候補一覧</span>
              <button
                type="button"
                className="close-candidates"
                onClick={() => toggleCandidates(fieldName)}
              >
                ×
              </button>
            </div>
            <div className="candidates-list">
              {fieldData.candidates.map((candidate, index) => (
                <button
                  key={index}
                  type="button"
                  className={`candidate-item ${candidate === fieldData.value ? 'selected' : ''}`}
                  onClick={() => selectCandidate(fieldName, candidate)}
                >
                  <span className="candidate-text">{candidate}</span>
                  {candidate === fieldData.value && (
                    <span className="selected-indicator">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!receiptData) {
    return (
      <div className="receipt-form">
        <div className="form-placeholder">
          <div className="placeholder-icon">📄</div>
          <h3>データが抽出されていません</h3>
          <p>画像を処理すると、ここに抽出されたデータが表示されます。</p>
        </div>
      </div>
    )
  }

  const hasAnyLowConfidence = Object.values(receiptData).some(
    field => typeof field === 'object' && 'confidence' in field && field.confidence < 0.8
  )

  return (
    <div className="receipt-form">
      <div className="form-header">
        <h3>領収書データ</h3>
        {hasAnyLowConfidence && (
          <div className="form-warning">
            ⚠️ 一部のフィールドで信頼度が低くなっています
          </div>
        )}
      </div>

      <form className="form-content">
        {renderField('date', '日付', receiptData.date, 'YYYY/MM/DD')}
        {renderField('payee', '支払先', receiptData.payee, '会社名・店舗名')}
        {renderField('amount', '金額', receiptData.amount, '金額（円）')}
        {renderField('usage', '適用', receiptData.usage, '利用内容・目的')}

        <div className="form-actions">
          <button 
            type="button" 
            className="save-button primary-button"
            onClick={onSave}
          >
            💾 保存
          </button>
          <button 
            type="button" 
            className="reset-button secondary-button"
            onClick={() => {
              // Reset to original extracted values
              if (receiptData) {
                onDataChange(receiptData)
              }
            }}
          >
            🔄 リセット
          </button>
        </div>
      </form>
    </div>
  )
}