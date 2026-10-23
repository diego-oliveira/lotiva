import { redirect } from 'next/navigation'

// Preserve bookmarks from the original single-partner screen.
export default async function LegacyPartnerSettlementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else if (value !== undefined) params.set(key, value)
  }
  redirect(`/distributions${params.size ? `?${params}` : ''}`)
}
