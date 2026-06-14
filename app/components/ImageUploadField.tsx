'use client'

import { useId, useState } from 'react'

type ImageUploadFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  onError?: (message: string) => void
  required?: boolean
  disabled?: boolean
  previewAlt?: string
}

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
const maxFileSize = 5 * 1024 * 1024

export default function ImageUploadField({
  label,
  value,
  onChange,
  error,
  onError,
  required = false,
  disabled = false,
  previewAlt = 'Imagem enviada',
}: ImageUploadFieldProps) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [internalError, setInternalError] = useState('')
  const displayedError = error || internalError

  const setError = (message: string) => {
    setInternalError(message)
    onError?.(message)
  }

  const upload = async (file?: File) => {
    if (!file) return
    if (!acceptedTypes.includes(file.type)) {
      setError('Use uma imagem PNG, JPG ou WebP.')
      return
    }
    if (file.size > maxFileSize) {
      setError('A imagem deve ter no maximo 5 MB.')
      return
    }

    try {
      setUploading(true)
      setError('')
      const payload = new FormData()
      payload.append('file', file)

      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: payload,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar imagem.')

      onChange(data.url)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Erro ao enviar imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className='mb-2 flex items-center justify-between gap-3'>
        <label htmlFor={inputId} className='text-sm font-semibold text-foreground'>
          {label}{required ? ' *' : ''}
        </label>
        {value && (
          <button
            type='button'
            onClick={() => {
              onChange('')
              setError('')
            }}
            disabled={disabled || uploading}
            className='text-xs font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-50'
          >
            Remover
          </button>
        )}
      </div>

      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled && !uploading) void upload(event.dataTransfer.files[0])
        }}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${
          dragging
            ? 'border-primary bg-primary/5'
            : displayedError
              ? 'border-red-300 bg-red-50/50'
              : 'border-border bg-surface hover:border-primary/50 hover:bg-primary/5'
        } ${disabled || uploading ? 'cursor-not-allowed opacity-70' : ''}`}
      >
        {value ? (
          <>
            <img src={value} alt={previewAlt} className='h-24 max-w-full object-contain' />
            <span className='mt-4 text-sm font-semibold text-primary'>
              {uploading ? 'Enviando imagem...' : 'Clique ou arraste para substituir'}
            </span>
          </>
        ) : (
          <>
            <span className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
              <svg className='h-6 w-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.8' d='M4 16.5V19h16v-2.5M12 4v11m0-11L7.5 8.5M12 4l4.5 4.5' />
              </svg>
            </span>
            <span className='mt-4 text-sm font-semibold text-foreground'>
              {uploading ? 'Enviando imagem...' : 'Clique ou arraste uma imagem'}
            </span>
            <span className='mt-1 text-xs text-muted'>PNG, JPG ou WebP, no maximo 5 MB</span>
          </>
        )}
        <input
          id={inputId}
          type='file'
          accept={acceptedTypes.join(',')}
          className='sr-only'
          disabled={disabled || uploading}
          onChange={(event) => {
            void upload(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </label>

      {displayedError && <p className='mt-2 text-sm text-red-600'>{displayedError}</p>}
    </div>
  )
}
