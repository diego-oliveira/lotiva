import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { getUploadFilePath, isSafePlanUploadFileName, uploadContentTypesByExtension } from '@/lib/uploadStorage'

export const runtime = 'nodejs'

type Params = { params: Promise<{ fileName: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { fileName } = await params
  if (!isSafePlanUploadFileName(fileName)) {
    return NextResponse.json({ error: 'Arquivo nao encontrado.' }, { status: 404 })
  }

  const extension = fileName.split('.').pop()?.toLowerCase()
  const contentType = extension ? uploadContentTypesByExtension[extension] : null
  if (!contentType) {
    return NextResponse.json({ error: 'Arquivo nao encontrado.' }, { status: 404 })
  }

  try {
    const file = await readFile(getUploadFilePath(fileName))
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Arquivo nao encontrado.' }, { status: 404 })
  }
}
