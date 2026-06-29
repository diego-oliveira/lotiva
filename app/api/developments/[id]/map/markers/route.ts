import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }
type MarkerInput = {
  lotId?: unknown
  xPercent?: unknown
  yPercent?: unknown
}

function normalizePercent(value: unknown) {
  if (value === null) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, numeric))
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const canManage = await hasDevelopmentPermission(userId, id, 'manageSettings')
  if (!canManage) return forbiddenResponse()

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    select: { id: true },
  })
  if (!development) return forbiddenResponse()

  const data = await req.json()
  const markers: MarkerInput[] = Array.isArray(data.markers) ? data.markers : []
  if (markers.length > 1000) {
    return NextResponse.json({ error: 'Envie no maximo 1000 marcacoes por vez.' }, { status: 400 })
  }

  const lotIds = markers
    .map((marker) => String(marker?.lotId || '').trim())
  if (lotIds.some((lotId) => !lotId)) {
    return NextResponse.json({ error: 'Todas as marcacoes precisam informar um lote.' }, { status: 400 })
  }
  if (markers.length === 0) {
    return NextResponse.json({ updated: 0 })
  }

  const uniqueLotIds = [...new Set(lotIds)]
  const allowedLots = await prisma.lot.findMany({
    where: {
      id: { in: uniqueLotIds },
      block: { developmentId: id },
    },
    select: { id: true },
  })
  const allowedLotIds = new Set(allowedLots.map((lot) => lot.id))
  if (allowedLotIds.size !== uniqueLotIds.length) {
    return NextResponse.json({ error: 'Uma ou mais marcacoes nao pertencem a este empreendimento.' }, { status: 400 })
  }

  await prisma.$transaction(markers.map((marker) => {
    const lotId = String(marker?.lotId || '').trim()
    return prisma.lot.update({
      where: { id: lotId },
      data: {
        mapXPercent: normalizePercent(marker?.xPercent),
        mapYPercent: normalizePercent(marker?.yPercent),
      },
    })
  }))

  return NextResponse.json({ updated: markers.length })
}
