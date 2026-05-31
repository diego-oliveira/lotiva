// app/api/reservations/route.ts
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, lotAccessWhere, reservationAccessWhere, userAccessWhere } from '@/lib/access-control'
import { NextResponse } from "next/server";

export async function GET() {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const userId = auth.session.user.id

    const reservations = await prisma.reservation.findMany({
    where: reservationAccessWhere(userId),
    include: { user: true, lot: { include: { block: { include: { development: true } } } } },
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
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: {
          id: data.userId,
          ...userAccessWhere(currentUserId),
        },
        select: { id: true },
      }),
    ])
    if (!lot || !user) return forbiddenResponse()

    const reservation = await prisma.reservation.create({
      data: {
        userId: data.userId,
        lotId: data.lotId,
        proposal: data.proposal,
        status: data.status,
      },
    });

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
