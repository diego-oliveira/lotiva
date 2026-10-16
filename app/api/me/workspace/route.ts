import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import { hasAccessToDevelopment } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response

  const data = await req.json().catch(() => ({}))
  const developmentId = String(data.developmentId || '').trim()
  if (!developmentId || !(await hasAccessToDevelopment(auth.session.user.id, developmentId))) {
    return NextResponse.json({ error: 'Empreendimento invalido ou sem acesso.' }, { status: 403 })
  }

  await prisma.user.update({
    where: { id: auth.session.user.id },
    data: { lastDevelopmentId: developmentId },
  })

  return NextResponse.json({ developmentId })
}
