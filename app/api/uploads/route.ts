import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { allowedImageTypes, buildUploadUrl, maxUploadSize, uploadDirectory } from '@/lib/uploadStorage'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie um arquivo de imagem.' }, { status: 400 })
  }

  const imageType = allowedImageTypes[file.type]
  if (!imageType) {
    return NextResponse.json({ error: 'Use uma imagem PNG, JPG ou WebP.' }, { status: 400 })
  }

  if (file.size > maxUploadSize) {
    return NextResponse.json({ error: 'A imagem deve ter no maximo 5 MB.' }, { status: 400 })
  }

  await mkdir(uploadDirectory, { recursive: true })

  const fileName = `${randomUUID()}.${imageType.extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDirectory, fileName), buffer)

  return NextResponse.json({ url: buildUploadUrl(fileName) }, { status: 201 })
}
