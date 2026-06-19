import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidUploadedImagePath } from '@/lib/uploadStorage'

type OnboardingPayload = {
  companyId?: string | null
  developmentId?: string | null
  developmentName?: string
  developmentLogo?: string
  blockCount?: number
  lotsPerBlock?: number
  lotArea?: number
  lotFront?: number
  lotBack?: number
  lotLeftSide?: number
  lotRightSide?: number
  lotPrice?: number
  initialStatus?: string
  blockPrefix?: string
}

const allowedStatuses = new Set(['available', 'reserved', 'on_hold', 'sold'])

function asPositiveNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function asPositiveInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function getBlockIdentifier(index: number, prefix: string) {
  if (prefix === 'letter') {
    return String.fromCharCode(65 + index)
  }

  return `${index + 1}`
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = (await req.json()) as OnboardingPayload
  const errors: Record<string, string> = {}

  const companyId = data.companyId?.trim() || null
  const developmentId = data.developmentId?.trim() || null
  const developmentName = data.developmentName?.trim() ?? ''
  const developmentLogo = data.developmentLogo?.trim() ?? ''
  const blockPrefix = data.blockPrefix === 'letter' ? 'letter' : 'number'
  const initialStatus = allowedStatuses.has(data.initialStatus ?? '') ? data.initialStatus! : 'available'

  const blockCount = asPositiveInteger(data.blockCount)
  const lotsPerBlock = asPositiveInteger(data.lotsPerBlock)
  const lotArea = asPositiveNumber(data.lotArea)
  const lotFront = asPositiveNumber(data.lotFront)
  const lotBack = asPositiveNumber(data.lotBack)
  const lotLeftSide = asPositiveNumber(data.lotLeftSide)
  const lotRightSide = asPositiveNumber(data.lotRightSide)
  const lotPrice = asPositiveNumber(data.lotPrice)

  if (!companyId) errors.companyId = 'Selecione a empresa proprietaria.'
  if (!developmentName) errors.developmentName = 'Informe o nome do empreendimento.'
  if (!isValidUploadedImagePath(developmentLogo)) errors.developmentLogo = 'Envie um logo valido para o empreendimento.'
  if (!blockCount || blockCount > 80) errors.blockCount = 'Informe entre 1 e 80 quadras.'
  if (!lotsPerBlock || lotsPerBlock > 200) errors.lotsPerBlock = 'Informe entre 1 e 200 lotes por quadra.'
  if (!lotArea) errors.lotArea = 'Informe a area padrao do lote.'
  if (!lotFront) errors.lotFront = 'Informe a medida de frente.'
  if (!lotBack) errors.lotBack = 'Informe a medida de fundo.'
  if (!lotLeftSide) errors.lotLeftSide = 'Informe a medida lateral esquerda.'
  if (!lotRightSide) errors.lotRightSide = 'Informe a medida lateral direita.'
  if (!lotPrice) errors.lotPrice = 'Informe o valor padrao do lote.'

  if (blockCount && lotsPerBlock && blockCount * lotsPerBlock > 1000) {
    errors.lotsPerBlock = 'Crie no maximo 1000 lotes pelo setup guiado.'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 })
  }

  const company = await prisma.company.findFirst({
    where: {
      id: companyId!,
      OR: [
        { developments: { some: { memberships: { some: { userId } } } } },
        { developments: { none: {} } },
      ],
    },
    select: { id: true },
  })
  if (!company) return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 })

  if (developmentId) {
    const development = await prisma.development.findFirst({
      where: {
        id: developmentId,
        memberships: { some: { userId } },
      },
      select: { id: true },
    })
    if (!development) return NextResponse.json({ error: 'Empreendimento nao encontrado.' }, { status: 404 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const development = developmentId
      ? await tx.development.update({
          where: { id: developmentId },
          data: {
            name: developmentName,
            logo: developmentLogo,
            companyId: companyId!,
          },
        })
      : await tx.development.create({
          data: {
            name: developmentName,
            logo: developmentLogo,
            companyId: companyId!,
            memberships: {
              create: {
                userId,
                roles: {
                  create: {
                    role: {
                      connectOrCreate: {
                        where: { name: 'OWNER' },
                        create: { name: 'OWNER' },
                      },
                    },
                  },
                },
              },
            },
          },
        })

    const existingLotCount = await tx.lot.count({
      where: {
        block: {
          developmentId: development.id,
        },
      },
    })

    let createdBlocks = 0
    let createdLots = 0

    if (existingLotCount === 0) {
      for (let blockIndex = 0; blockIndex < blockCount!; blockIndex += 1) {
        const block = await tx.block.create({
          data: {
            identifier: getBlockIdentifier(blockIndex, blockPrefix),
            developmentId: development.id,
          },
        })

        await tx.lot.createMany({
          data: Array.from({ length: lotsPerBlock! }, (_, lotIndex) => ({
            identifier: `${lotIndex + 1}`.padStart(2, '0'),
            blockId: block.id,
            front: lotFront!,
            back: lotBack!,
            leftSide: lotLeftSide!,
            rightSide: lotRightSide!,
            totalArea: lotArea!,
            price: lotPrice!,
            status: initialStatus,
          })),
        })
      }

      createdBlocks = blockCount!
      createdLots = blockCount! * lotsPerBlock!
    }

    return {
      company,
      development,
      createdBlocks,
      createdLots,
      updatedExistingSetup: Boolean(developmentId),
      skippedInventoryCreation: existingLotCount > 0,
    }
  })

  return NextResponse.json(result, { status: 201 })
}
