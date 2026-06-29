import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { isValidUploadedPlanPath } from '@/lib/uploadStorage'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function inferFileType(fileUrl: string) {
  return fileUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    include: {
      map: true,
      blocks: {
        include: {
          lots: {
            select: {
              id: true,
              identifier: true,
              status: true,
              mapXPercent: true,
              mapYPercent: true,
              block: { select: { id: true, identifier: true } },
              sale: { select: { id: true } },
              reservations: {
                where: {
                  cancelledAt: null,
                  status: { not: 'cancelled' },
                  sale: null,
                },
                select: { id: true },
                take: 1,
              },
            },
            orderBy: { identifier: 'asc' },
          },
        },
        orderBy: { identifier: 'asc' },
      },
    },
  })

  if (!development) return forbiddenResponse()

  return NextResponse.json({
    map: development.map,
    lots: development.blocks.flatMap((block) => block.lots.map((lot) => ({
      ...lot,
      effectiveStatus: lot.sale || lot.status === 'sold'
        ? 'sold'
        : lot.reservations.length > 0
          ? 'reserved'
          : lot.status,
    }))),
  })
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const { id } = await params

  const canManage = await hasDevelopmentPermission(userId, id, 'manageSettings')
  if (!canManage) return forbiddenResponse()

  const data = await req.json()
  const fileUrl = String(data.fileUrl || '').trim()
  if (!fileUrl || !isValidUploadedPlanPath(fileUrl)) {
    return NextResponse.json({ error: 'Envie uma planta valida.' }, { status: 400 })
  }

  const fileType = inferFileType(fileUrl)
  const pdfPageNumber = Math.max(1, Math.trunc(Number(data.pdfPageNumber) || 1))

  const development = await prisma.development.findFirst({
    where: {
      id,
      ...membershipWhere(userId),
    },
    select: { id: true },
  })
  if (!development) return forbiddenResponse()

  const map = await prisma.developmentMap.upsert({
    where: { developmentId: id },
    create: {
      developmentId: id,
      fileUrl,
      fileType,
      pdfPageNumber,
    },
    update: {
      fileUrl,
      fileType,
      pdfPageNumber,
    },
  })

  return NextResponse.json(map)
}
