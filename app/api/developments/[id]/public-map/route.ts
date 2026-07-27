import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'

type Params = { params: Promise<{ id: string }> }

function createShareToken() {
  return randomBytes(18).toString('base64url')
}

function buildPublicUrl(req: NextRequest, token: string) {
  const configuredOrigin = process.env.NEXTAUTH_URL || process.env.AUTH_URL
  if (configuredOrigin) {
    const url = new URL(configuredOrigin)
    return `${url.origin}/p/${token}`
  }

  const forwardedHost = req.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const forwardedProto = req.headers.get('x-forwarded-proto') ?? 'https'
    return `${forwardedProto.split(',')[0]}://${forwardedHost.split(',')[0]}/p/${token}`
  }

  const url = new URL(req.url)
  return `${url.origin}/p/${token}`
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  if (!(await hasDevelopmentPermission(userId, id, 'manageSettings'))) return forbiddenResponse()

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    select: {
      id: true,
      publicMapToken: true,
      publicMapEnabled: true,
      publicMapShowPrices: true,
      map: { select: { id: true } },
    },
  })
  if (!development) return forbiddenResponse()
  if (!development.map) {
    return NextResponse.json({ error: 'Configure uma planta antes de compartilhar o mapa publico.' }, { status: 400 })
  }

  const payload = await req.json().catch(() => ({}))
  const showPrices = payload.showPrices === undefined ? development.publicMapShowPrices : payload.showPrices !== false

  let token = development.publicMapToken
  if (!token || payload.regenerate === true) token = createShareToken()

  const saved = await prisma.development.update({
    where: { id },
    data: {
      publicMapEnabled: true,
      publicMapToken: token,
      publicMapShowPrices: showPrices,
    },
    select: {
      publicMapToken: true,
      publicMapEnabled: true,
      publicMapShowPrices: true,
    },
  })

  return NextResponse.json({
    ...saved,
    url: buildPublicUrl(req, saved.publicMapToken!),
  })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  if (!(await hasDevelopmentPermission(userId, id, 'manageSettings'))) return forbiddenResponse()

  await prisma.development.update({
    where: { id },
    data: { publicMapEnabled: false },
  })

  return NextResponse.json({ ok: true })
}
