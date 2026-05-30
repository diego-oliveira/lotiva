import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { NextResponse } from 'next/server'

const MEMBERSHIP_INCLUDE = {
  memberships: {
    include: {
      development: true,
      roles: { include: { role: true } },
    },
  },
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response

    const clients = await prisma.user.findMany({
      include: MEMBERSHIP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('GET /api/clients:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response

    const data = await req.json()

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'Nome e obrigatorio.' }, { status: 400 })
    }
    if (!data.email?.trim()) {
      return NextResponse.json({ error: 'Email e obrigatorio.' }, { status: 400 })
    }

    const memberships: { developmentId: string; roleId: string }[] = data.memberships ?? []

    const newUser = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim(),
        cpf: data.cpf || null,
        rg: data.rg || null,
        address: data.address || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        profession: data.profession || null,
        birthplace: data.birthplace || null,
        maritalStatus: data.maritalStatus || null,
      },
    })

    for (const m of memberships) {
      if (!m.developmentId) continue
      const devUser = await prisma.developmentUser.create({
        data: { developmentId: m.developmentId, userId: newUser.id },
      })
      if (m.roleId) {
        await prisma.developmentUserRole.create({
          data: { developmentUserId: devUser.id, roleId: m.roleId },
        })
      }
    }

    const user = await prisma.user.findUnique({ where: { id: newUser.id }, include: MEMBERSHIP_INCLUDE })
    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : []
      if (target.includes('email')) {
        return NextResponse.json({ error: 'Este email ja esta cadastrado.' }, { status: 400 })
      }
      if (target.includes('cpf')) {
        return NextResponse.json({ error: 'Este CPF ja esta cadastrado.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Ja existe um usuario com estes dados.' }, { status: 400 })
    }
    console.error('POST /api/clients:', error)
    return NextResponse.json({ error: 'Erro ao salvar usuario.' }, { status: 500 })
  }
}
