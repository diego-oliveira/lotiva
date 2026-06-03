'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type DevelopmentOption = {
  id: string
  name: string
}

type FinanceDevelopmentSelectProps = {
  developments: DevelopmentOption[]
  selectedDevelopmentId: string
}

export default function FinanceDevelopmentSelect({
  developments,
  selectedDevelopmentId,
}: FinanceDevelopmentSelectProps) {
  return (
    <Suspense fallback={null}>
      <FinanceDevelopmentSelectContent developments={developments} selectedDevelopmentId={selectedDevelopmentId} />
    </Suspense>
  )
}

function FinanceDevelopmentSelectContent({
  developments,
  selectedDevelopmentId,
}: FinanceDevelopmentSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (developmentId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('developmentId', developmentId)
    router.push(`/finance?${params.toString()}`)
  }

  return (
    <label className='block'>
      <span className='mb-2 block text-sm font-semibold text-foreground'>Empreendimento</span>
      <select
        value={selectedDevelopmentId}
        onChange={(event) => handleChange(event.target.value)}
        className='w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground outline-none transition focus:ring-2 focus:ring-primary'
      >
        {developments.map((development) => (
          <option key={development.id} value={development.id}>
            {development.name}
          </option>
        ))}
      </select>
    </label>
  )
}
