import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLotEvent } from '@/lib/lot-events'

type Params = { params: Promise<{ token: string }> }

const activeInterestStatuses = ['pending', 'contacted']

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '')
}

function validateInterestPayload(data: any) {
  const name = String(data.name || '').trim()
  const email = normalizeEmail(data.email)
  const phone = normalizePhone(data.phone)
  const notes = String(data.notes || '').trim()
  const errors: Record<string, string> = {}

  if (name.length < 3) errors.name = 'Informe seu nome.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Informe um e-mail valido.'
  if (phone.length < 10 || phone.length > 13) errors.phone = 'Informe um telefone valido.'
  if (notes.length > 1000) errors.notes = 'A observacao deve ter ate 1000 caracteres.'

  return {
    values: { name, email, phone, notes: notes || null },
    errors,
  }
}

function getEffectiveStatus(lot: {
  status: string
  sale: { id: string } | null
  reservations: Array<{ id: string }>
  _count: { publicInterests: number }
}) {
  if (lot.sale || lot.status === 'sold') return 'sold'
  if (lot.reservations.length > 0) return 'reserved'
  if (lot.status === 'on_hold') return 'on_hold'
  if (lot._count.publicInterests > 0) return 'requested'
  return lot.status
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const development = await prisma.development.findFirst({
    where: {
      publicMapToken: token,
      publicMapEnabled: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      logo: true,
      publicMapShowPrices: true,
      map: true,
      blocks: {
        select: {
          id: true,
          identifier: true,
          lots: {
            select: {
              id: true,
              identifier: true,
              totalArea: true,
              price: true,
              status: true,
              mapXPercent: true,
              mapYPercent: true,
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
              _count: {
                select: {
                  publicInterests: {
                    where: { status: { in: activeInterestStatuses } },
                  },
                },
              },
            },
            orderBy: { identifier: 'asc' },
          },
        },
        orderBy: { identifier: 'asc' },
      },
    },
  })

  if (!development || !development.map) {
    return NextResponse.json({ error: 'Mapa publico indisponivel.' }, { status: 404 })
  }

  return NextResponse.json({
    development: {
      id: development.id,
      name: development.name,
      logo: development.logo,
      showPrices: development.publicMapShowPrices,
    },
    map: development.map,
    lots: development.blocks.flatMap((block) => block.lots.map((lot) => {
      const interestCount = lot._count.publicInterests
      return {
        id: lot.id,
        identifier: lot.identifier,
        block: { id: block.id, identifier: block.identifier },
        totalArea: lot.totalArea,
        price: development.publicMapShowPrices ? lot.price : null,
        mapXPercent: lot.mapXPercent,
        mapYPercent: lot.mapYPercent,
        status: getEffectiveStatus(lot),
        interestCount,
      }
    })),
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  const data = await req.json().catch(() => null)
  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 })
  }

  const lotId = String(data.lotId || '')
  const { values, errors } = validateInterestPayload(data)
  if (!lotId) errors.lotId = 'Selecione um lote.'
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Revise os dados informados.', errors }, { status: 400 })
  }

  const development = await prisma.development.findFirst({
    where: {
      publicMapToken: token,
      publicMapEnabled: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  })
  if (!development) {
    return NextResponse.json({ error: 'Mapa publico indisponivel.' }, { status: 404 })
  }

  const lot = await prisma.lot.findFirst({
    where: {
      id: lotId,
      block: { developmentId: development.id },
    },
    select: {
      id: true,
      identifier: true,
      status: true,
      block: { select: { identifier: true } },
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
  })
  if (!lot) return NextResponse.json({ error: 'Lote nao encontrado.' }, { status: 404 })
  if (lot.sale || lot.status === 'sold') {
    return NextResponse.json({ error: 'Este lote ja foi vendido.' }, { status: 400 })
  }
  if (lot.reservations.length > 0 || lot.status === 'reserved') {
    return NextResponse.json({ error: 'Este lote ja esta reservado.' }, { status: 400 })
  }
  if (lot.status === 'on_hold') {
    return NextResponse.json({ error: 'Este lote esta bloqueado no momento.' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.publicLotInterest.findFirst({
      where: {
        developmentId: development.id,
        lotId: lot.id,
        status: { in: activeInterestStatuses },
        OR: [
          { email: values.email },
          { phone: values.phone },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })

    const interest = existing
      ? await tx.publicLotInterest.update({
          where: { id: existing.id },
          data: {
            name: values.name,
            email: values.email,
            phone: values.phone,
            notes: values.notes,
            status: 'pending',
          },
        })
      : await tx.publicLotInterest.create({
          data: {
            developmentId: development.id,
            lotId: lot.id,
            name: values.name,
            email: values.email,
            phone: values.phone,
            notes: values.notes,
          },
        })

    if (!existing) {
      await createLotEvent(tx, {
        lotId: lot.id,
        userId: null,
        type: 'public_interest_created',
        title: 'Interesse publico registrado',
        description: `${values.name} entrou na fila pelo mapa publico.`,
        notes: values.notes,
      })
    }

    const queuePosition = await tx.publicLotInterest.count({
      where: {
        lotId: lot.id,
        status: { in: activeInterestStatuses },
        createdAt: { lte: interest.createdAt },
      },
    })

    return { interest, queuePosition, existing: Boolean(existing) }
  })

  return NextResponse.json({
    id: result.interest.id,
    status: result.interest.status,
    queuePosition: result.queuePosition,
    alreadyExisted: result.existing,
    message: result.existing
      ? 'Sua solicitacao ja estava na fila e foi atualizada.'
      : 'Solicitacao recebida com sucesso.',
  }, { status: result.existing ? 200 : 201 })
}
