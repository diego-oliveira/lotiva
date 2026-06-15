import { requireAuthenticatedUser } from '@/lib/auth'
import { createSampleDocx } from '@/lib/docxDocuments'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const buffer = await createSampleDocx()
  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="modelo-variaveis-lotiva.docx"',
    },
  })
}

