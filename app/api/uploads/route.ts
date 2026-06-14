import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { allowedImageTypes, buildUploadUrl, maxUploadSize, uploadDirectory } from '@/lib/uploadStorage'

export const runtime = 'nodejs'

function matchesImageSignature(buffer: Buffer, contentType: string) {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (contentType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (contentType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

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
  if (!matchesImageSignature(buffer, imageType.contentType)) {
    return NextResponse.json({ error: 'O arquivo enviado nao corresponde a uma imagem valida.' }, { status: 400 })
  }
  await writeFile(path.join(uploadDirectory, fileName), buffer)

  return NextResponse.json({ url: buildUploadUrl(fileName) }, { status: 201 })
}
