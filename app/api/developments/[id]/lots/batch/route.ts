import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, hasAccessToDevelopment } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ id: string }> }

type LotInput = {
  blockIdentifier?: string
  identifier?: string
  front?: number
  back?: number
  leftSide?: number
  rightSide?: number
  totalArea?: number
  price?: number
  status?: string
}

const allowedStatuses = new Set(['available', 'reserved', 'on_hold', 'sold'])

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function validateLot(lot: LotInput, index: number, fallbackBlockIdentifier: string) {
  const errors: string[] = []
  if (!String(lot.blockIdentifier || fallbackBlockIdentifier || '').trim()) errors.push(`Lote ${index + 1}: quadra obrigatoria.`)
  if (!String(lot.identifier || '').trim()) errors.push(`Lote ${index + 1}: identificador obrigatorio.`)
  if (toNumber(lot.front) <= 0) errors.push(`Lote ${index + 1}: frente deve ser maior que zero.`)
  if (toNumber(lot.back) <= 0) errors.push(`Lote ${index + 1}: fundo deve ser maior que zero.`)
  if (toNumber(lot.leftSide) <= 0) errors.push(`Lote ${index + 1}: lateral esquerda deve ser maior que zero.`)
  if (toNumber(lot.rightSide) <= 0) errors.push(`Lote ${index + 1}: lateral direita deve ser maior que zero.`)
  if (toNumber(lot.totalArea) <= 0) errors.push(`Lote ${index + 1}: area deve ser maior que zero.`)
  if (toNumber(lot.price) < 0) errors.push(`Lote ${index + 1}: valor nao pode ser negativo.`)
  if (lot.status && !allowedStatuses.has(lot.status)) errors.push(`Lote ${index + 1}: status invalido.`)
  return errors
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const canAccessDevelopment = await hasAccessToDevelopment(userId, id)
  if (!canAccessDevelopment) return forbiddenResponse()

  const payload = await req.json()
  const blockIdentifier = String(payload.blockIdentifier || '').trim()
  const lots = Array.isArray(payload.lots) ? payload.lots as LotInput[] : []

  const errors: string[] = []
  if (lots.length === 0) errors.push('Inclua pelo menos um lote.')
  if (lots.length > 300) errors.push('Crie no maximo 300 lotes por vez.')
  lots.forEach((lot, index) => errors.push(...validateLot(lot, index, blockIdentifier)))

  const duplicateIdentifiers = lots
    .map((lot) => {
      const lotBlockIdentifier = String(lot.blockIdentifier || blockIdentifier || '').trim()
      const identifier = String(lot.identifier || '').trim()
      return lotBlockIdentifier && identifier ? `${lotBlockIdentifier.toLowerCase()}::${identifier.toLowerCase()}` : ''
    })
    .filter((identifier, index, identifiers) => identifier && identifiers.indexOf(identifier) !== index)
  if (duplicateIdentifiers.length > 0) errors.push('Existem lotes repetidos para a mesma quadra na pre-visualizacao.')

  if (lots.length > 0) {
    const requestedBlockIdentifiers = [...new Set(lots.map((lot) => String(lot.blockIdentifier || blockIdentifier).trim()).filter(Boolean))]
    const existingBlocks = requestedBlockIdentifiers.length > 0
      ? await prisma.block.findMany({
          where: {
            developmentId: id,
            identifier: { in: requestedBlockIdentifiers },
          },
          include: {
            lots: { select: { identifier: true } },
          },
        })
      : []
    const existingLotKeys = new Set(existingBlocks.flatMap((block) => (
      block.lots.map((lot) => `${block.identifier.toLowerCase()}::${lot.identifier.toLowerCase()}`)
    )))
    const conflictingLots = lots
      .map((lot) => {
        const lotBlockIdentifier = String(lot.blockIdentifier || blockIdentifier || '').trim()
        const identifier = String(lot.identifier || '').trim()
        return { label: `Quadra ${lotBlockIdentifier}, lote ${identifier}`, key: `${lotBlockIdentifier.toLowerCase()}::${identifier.toLowerCase()}` }
      })
      .filter((lot) => existingLotKeys.has(lot.key))
      .map((lot) => lot.label)
    if (conflictingLots.length > 0) {
      errors.push(`Ja existem lotes cadastrados para esta importacao: ${conflictingLots.slice(0, 5).join('; ')}${conflictingLots.length > 5 ? '...' : ''}.`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Revise os dados antes de criar os lotes.', errors }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const blocksByIdentifier = new Map<string, { id: string; identifier: string }>()
    const requestedBlockIdentifiers = [...new Set(lots.map((lot) => String(lot.blockIdentifier || blockIdentifier).trim()))]
    const existingBlocks = await tx.block.findMany({
      where: {
        developmentId: id,
        identifier: { in: requestedBlockIdentifiers },
      },
      select: { id: true, identifier: true },
    })
    existingBlocks.forEach((block) => blocksByIdentifier.set(block.identifier, block))

    const createdLots = []
    for (const lotInput of lots) {
      const lotBlockIdentifier = String(lotInput.blockIdentifier || blockIdentifier).trim()
      let block = blocksByIdentifier.get(lotBlockIdentifier)
      if (!block) {
        block = await tx.block.create({
          data: {
            identifier: lotBlockIdentifier,
            developmentId: id,
          },
          select: { id: true, identifier: true },
        })
        blocksByIdentifier.set(lotBlockIdentifier, block)
      }

      const lot = await tx.lot.create({
        data: {
          identifier: String(lotInput.identifier || '').trim(),
          blockId: block.id,
          front: toNumber(lotInput.front),
          back: toNumber(lotInput.back),
          leftSide: toNumber(lotInput.leftSide),
          rightSide: toNumber(lotInput.rightSide),
          totalArea: toNumber(lotInput.totalArea),
          price: toNumber(lotInput.price),
          status: allowedStatuses.has(lotInput.status || '') ? lotInput.status! : 'available',
        },
      })

      await createLotEvent(tx, {
        lotId: lot.id,
        userId,
        type: 'lot_created',
        title: 'Lote cadastrado',
        description: `Lote ${lot.identifier} criado pela geracao em lote da quadra ${block.identifier}.`,
      })

      createdLots.push(lot)
    }

    return { blocks: Array.from(blocksByIdentifier.values()), lots: createdLots }
  })

  return NextResponse.json(result, { status: 201 })
}
