'use client'

import { useEffect, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type NumberTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value: number
  onValueChange: (value: number) => void
  emptyValue?: number
}

function parseLocalizedNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').trim()
  if (!normalized) return null

  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma > dot) return Number(normalized.replace(/\./g, '').replace(',', '.'))
  if (dot > comma && comma >= 0) return Number(normalized.replace(/,/g, ''))
  if (dot >= 0) {
    const [integerPart, decimalPart = ''] = normalized.split('.')
    const hasMultipleDots = normalized.indexOf('.') !== dot
    const looksLikeThousands = hasMultipleDots || decimalPart.length === 3
    if (looksLikeThousands) return Number(normalized.replace(/\./g, ''))
    return Number(`${integerPart}.${decimalPart}`)
  }
  return Number(normalized.replace(',', '.'))
}

export function NumberTextInput({
  value,
  onValueChange,
  emptyValue = 0,
  onFocus,
  onBlur,
  inputMode = 'decimal',
  ...props
}: NumberTextInputProps) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [focused, value])

  return (
    <input
      {...props}
      type='text'
      inputMode={inputMode}
      value={text}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      onChange={(event) => {
        const nextText = event.target.value
        setText(nextText)
        const nextValue = parseLocalizedNumber(nextText)
        onValueChange(Number.isFinite(nextValue) ? nextValue! : emptyValue)
      }}
    />
  )
}

type CurrencyTextInputProps = Omit<NumberTextInputProps, 'inputMode'>

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatCurrencyForEditing(value: number) {
  if (!value) return ''

  const [integerPart, decimalPart = ''] = String(value).split('.')
  const integer = Number(integerPart || 0).toLocaleString('pt-BR')
  const decimals = decimalPart.replace(/\D/g, '').slice(0, 2)

  return decimals ? `R$ ${integer},${decimals}` : `R$ ${integer}`
}

function formatCurrencyInputText(value: string) {
  const normalized = value.replace(/[^\d,]/g, '')
  if (!normalized) return ''

  const comma = normalized.indexOf(',')
  const integerDigits = (comma >= 0 ? normalized.slice(0, comma) : normalized).replace(/\D/g, '')
  const decimalDigits = comma >= 0 ? normalized.slice(comma + 1).replace(/\D/g, '').slice(0, 2) : ''
  const integer = Number(integerDigits || 0).toLocaleString('pt-BR')

  return comma >= 0 ? `R$ ${integer},${decimalDigits}` : `R$ ${integer}`
}

export function CurrencyTextInput({
  value,
  onValueChange,
  emptyValue = 0,
  onFocus,
  onBlur,
  ...props
}: CurrencyTextInputProps) {
  const [text, setText] = useState(formatCurrency(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatCurrency(value))
  }, [focused, value])

  return (
    <input
      {...props}
      type='text'
      inputMode='decimal'
      value={text}
      onFocus={(event) => {
        setFocused(true)
        setText(formatCurrencyForEditing(value))
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      onChange={(event) => {
        const nextText = formatCurrencyInputText(event.target.value)
        setText(nextText)
        const nextValue = parseLocalizedNumber(nextText)
        onValueChange(Number.isFinite(nextValue) ? nextValue! : emptyValue)
      }}
    />
  )
}
