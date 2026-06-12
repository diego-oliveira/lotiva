import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params

  const notification = await prisma.notification.findFirst({
    where: { id, userId: auth.session.user.id },
    select: { id: true },
  })
  if (!notification) {
    return NextResponse.json({ error: 'Notificacao nao encontrada.' }, { status: 404 })
  }

  return NextResponse.json(
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    }),
  )
}
