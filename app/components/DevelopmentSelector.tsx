'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type DevelopmentOption = {
  id: string
  name: string
  companyName: string
}

export default function DevelopmentSelector({
  developments,
  selectedDevelopmentId,
}: {
  developments: DevelopmentOption[]
  selectedDevelopmentId: string
}) {
  return (
    <Suspense fallback={null}>
      <DevelopmentSelectorContent developments={developments} selectedDevelopmentId={selectedDevelopmentId} />
    </Suspense>
  )
}

function DevelopmentSelectorContent({
  developments,
  selectedDevelopmentId,
}: {
  developments: DevelopmentOption[]
  selectedDevelopmentId: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (developmentId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('developmentId', developmentId)
    router.push(`/?${params.toString()}`)
  }

  return (
    <label className='block w-full sm:max-w-sm'>
      <span className='mb-2 block text-xs font-semibold uppercase text-muted'>Empreendimento</span>
      <select
        value={selectedDevelopmentId}
        onChange={(event) => handleChange(event.target.value)}
        className='w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground outline-none transition focus:ring-2 focus:ring-primary'
      >
        {developments.map((development) => (
          <option key={development.id} value={development.id}>
            {development.name} - {development.companyName}
          </option>
        ))}
      </select>
    </label>
  )
}
