import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { forbiddenResponse } from '@/lib/access-control'

export const runtime = 'nodejs'
const directory = process.env.PARTNER_PROOF_DIR
  ? path.resolve(process.env.PARTNER_PROOF_DIR)
  : path.join(process.cwd(), 'storage', 'partner-proofs')
const types: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const developmentPattern = /^[a-f0-9-]{36}$/

export async function POST(req: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const developmentId = req.nextUrl.searchParams.get('developmentId') || ''
  if (!developmentPattern.test(developmentId) || !(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'issuePayments'))) return forbiddenResponse()
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Envie um comprovante de até 5 MB.' }, { status: 400 })
  const buffer = Buffer.from(await file.arrayBuffer())
  const extension = Object.keys(types).find((extension) => types[extension] === file.type)
  const valid = extension === 'pdf' ? buffer.subarray(0, 5).toString() === '%PDF-'
    : extension === 'png' ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : extension === 'jpg' ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        : extension === 'webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  if (!valid || !extension) return NextResponse.json({ error: 'Use PDF, PNG, JPG ou WebP válido.' }, { status: 400 })
  const folder = path.join(directory, developmentId)
  const filename = `${randomUUID()}.${extension}`
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, filename), buffer, { flag: 'wx', mode: 0o600 })
  return NextResponse.json({ url: `/api/partner-settlements/proofs?developmentId=${encodeURIComponent(developmentId)}&file=${filename}` }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const developmentId = req.nextUrl.searchParams.get('developmentId') || ''
  if (!developmentPattern.test(developmentId) || !(await hasDevelopmentPermission(auth.session.user.id, developmentId, 'finance'))) return forbiddenResponse()
  const filename = req.nextUrl.searchParams.get('file') || ''
  if (!/^[a-f0-9-]{36}\.(pdf|png|jpg|webp)$/.test(filename)) return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 })
  try {
    const buffer = await readFile(path.join(directory, developmentId, filename))
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': types[filename.split('.').pop()!], 'Content-Disposition': `inline; filename="comprovante.${filename.split('.').pop()}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return NextResponse.json({ error: 'Comprovante não encontrado.' }, { status: 404 })
  }
}
