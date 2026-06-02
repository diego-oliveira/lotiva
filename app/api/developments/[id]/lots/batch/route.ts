import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, hasAccessToDevelopment } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ id: string }> }

type LotInput = {
  identifier?: string
  front?: number
  back?: number
  leftSide?: number
  rightSide?: number
  totalArea?: number
  price?: number
  status?: string
}

function toNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function validateLot(lot: LotInput, index: number) {
  const errors: string[] = []
  if (!String(lot.identifier || '').trim()) errors.push(`Lote ${index + 1}: identificador obrigatorio.`)
  if (toNumber(lot.front) <= 0) errors.push(`Lote ${index + 1}: frente deve ser maior que zero.`)
  if (toNumber(lot.back) <= 0) errors.push(`Lote ${index + 1}: fundo deve ser maior que zero.`)
  if (toNumber(lot.leftSide) <= 0) errors.push(`Lote ${index + 1}: lateral esquerda deve ser maior que zero.`)
  if (toNumber(lot.rightSide) <= 0) errors.push(`Lote ${index + 1}: lateral direita deve ser maior que zero.`)
  if (toNumber(lot.totalArea) <= 0) errors.push(`Lote ${index + 1}: area deve ser maior que zero.`)
  if (toNumber(lot.price) < 0) errors.push(`Lote ${index + 1}: valor nao pode ser negativo.`)
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
  if (!blockIdentifier) errors.push('Informe o nome da quadra.')
  if (lots.length === 0) errors.push('Inclua pelo menos um lote.')
  if (lots.length > 300) errors.push('Crie no maximo 300 lotes por vez.')
  lots.forEach((lot, index) => errors.push(...validateLot(lot, index)))

  const duplicateIdentifiers = lots
    .map((lot) => String(lot.identifier || '').trim())
    .filter((identifier, index, identifiers) => identifier && identifiers.indexOf(identifier) !== index)
  if (duplicateIdentifiers.length > 0) errors.push('Existem identificadores de lotes repetidos na pre-visualizacao.')

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Revise os dados antes de criar os lotes.', errors }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const block = await tx.block.create({
      data: {
        identifier: blockIdentifier,
        developmentId: id,
      },
    })

    const createdLots = []
    for (const lotInput of lots) {
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
          status: lotInput.status || 'available',
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

    return { block, lots: createdLots }
  })

  return NextResponse.json(result, { status: 201 })
}
