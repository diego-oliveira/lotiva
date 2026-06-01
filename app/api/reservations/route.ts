import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, userAccessWhere } from '@/lib/access-control'
import { NextResponse } from "next/server";
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'

function parseExpiration(value: unknown, fallbackDays: number) {
  if (typeof value === 'string' && value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + fallbackDays)
  return expiresAt
}

export async function GET() {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const userId = auth.session.user.id

  const reservations = await prisma.reservation.findMany({
    where: reservationAccessWhere(userId),
    include: { user: true, sale: true, lot: { include: { block: { include: { development: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reservations);
}

export async function POST(req: Request) {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const currentUserId = auth.session.user.id

    const data = await req.json();

  try {
    const [lot, user] = await Promise.all([
      prisma.lot.findFirst({
        where: {
          id: data.lotId,
          ...lotAccessWhere(currentUserId),
        },
        include: {
          block: {
            include: {
              development: {
                include: { settings: true },
              },
            },
          },
          sale: true,
          reservations: {
            include: { sale: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.user.findFirst({
        where: {
          id: data.userId,
          ...userAccessWhere(currentUserId),
        },
        select: { id: true, name: true },
      }),
    ])
    if (!lot || !user) return forbiddenResponse()
    const developmentId = lot.block.developmentId
    if (!developmentId || !(await hasDevelopmentPermission(currentUserId, developmentId, 'sales'))) return forbiddenResponse()
    if (lot.sale || lot.status === 'sold') {
      return NextResponse.json({ error: 'Este lote ja foi vendido.' }, { status: 400 })
    }

    const fallbackDays = lot.block.development?.settings?.reservationValidityDays ?? 7
    const expiresAt = parseExpiration(data.expiresAt, fallbackDays)
    if (expiresAt <= new Date()) {
      return NextResponse.json({ error: 'A validade da reserva deve ser futura.' }, { status: 400 })
    }

    const existingReservation = lot.reservations[0]

    const reservation = await prisma.$transaction(async (tx) => {
      const savedReservation = existingReservation
        ? await tx.reservation.update({
            where: { id: existingReservation.id },
            data: {
              userId: data.userId,
              proposal: data.proposal || '',
              status: data.status || 'active',
              expiresAt,
              cancelledAt: null,
            },
          })
        : await tx.reservation.create({
            data: {
              userId: data.userId,
              lotId: data.lotId,
              proposal: data.proposal || '',
              status: data.status || 'active',
              expiresAt,
            },
          })

      await tx.lot.update({
        where: { id: data.lotId },
        data: { status: 'reserved' },
      })

      await createLotEvent(tx, {
        lotId: data.lotId,
        userId: currentUserId,
        type: existingReservation ? 'reservation_updated' : 'reservation_created',
        title: existingReservation ? 'Reserva atualizada' : 'Reserva registrada',
        description: `Reserva para ${user.name} com validade em ${expiresAt.toLocaleDateString('pt-BR')}.`,
        notes: data.proposal || null,
      })

      return savedReservation
    })

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "This lot already has a reservation." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Unknown error." }, { status: 500 });
  }
}
