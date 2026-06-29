import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { allowedImageTypes, allowedPlanFileTypes, buildUploadUrl, maxPlanUploadSize, maxUploadSize, uploadDirectory } from '@/lib/uploadStorage'

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

function matchesPlanFileSignature(buffer: Buffer, contentType: string) {
  if (contentType === 'application/pdf') {
    return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }

  return matchesImageSignature(buffer, contentType)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const formData = await req.formData()
  const file = formData.get('file')
  const purpose = String(formData.get('purpose') || 'image')
  const isPlanUpload = purpose === 'development-map'

  if (!(file instanceof File)) {
    return NextResponse.json({ error: isPlanUpload ? 'Envie uma imagem ou PDF.' : 'Envie um arquivo de imagem.' }, { status: 400 })
  }

  const fileType = isPlanUpload ? allowedPlanFileTypes[file.type] : allowedImageTypes[file.type]
  if (!fileType) {
    return NextResponse.json({ error: isPlanUpload ? 'Use uma imagem PNG, JPG, WebP ou PDF.' : 'Use uma imagem PNG, JPG ou WebP.' }, { status: 400 })
  }

  const sizeLimit = isPlanUpload ? maxPlanUploadSize : maxUploadSize
  if (file.size > sizeLimit) {
    return NextResponse.json({ error: isPlanUpload ? 'A planta deve ter no maximo 20 MB.' : 'A imagem deve ter no maximo 5 MB.' }, { status: 400 })
  }

  await mkdir(uploadDirectory, { recursive: true })

  const fileName = `${randomUUID()}.${fileType.extension}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const hasValidSignature = isPlanUpload
    ? matchesPlanFileSignature(buffer, fileType.contentType)
    : matchesImageSignature(buffer, fileType.contentType)
  if (!hasValidSignature) {
    return NextResponse.json({ error: isPlanUpload ? 'O arquivo enviado nao corresponde a uma planta valida.' : 'O arquivo enviado nao corresponde a uma imagem valida.' }, { status: 400 })
  }
  await writeFile(path.join(uploadDirectory, fileName), buffer)

  return NextResponse.json({ url: buildUploadUrl(fileName) }, { status: 201 })
}
