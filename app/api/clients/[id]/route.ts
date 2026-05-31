import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  forbiddenResponse,
  getAccessibleDevelopmentIds,
  hasAccessToAllDevelopments,
  membershipWhere,
  proposalAccessWhere,
  reservationAccessWhere,
  saleAccessWhere,
  userAccessWhere,
} from '@/lib/access-control'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

const membershipInclude = (userId: string) => ({
  memberships: {
    where: {
      development: membershipWhere(userId),
    },
    include: {
      development: true,
      roles: { include: { role: true } },
    },
  },
})

export async function GET(_: Request, { params }: Params) {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const currentUserId = auth.session.user.id

    const { id } = await params
    const client = await prisma.user.findFirst({
      where: {
        id,
        ...userAccessWhere(currentUserId),
      },
      include: {
        ...membershipInclude(currentUserId),
        reservations: {
          where: reservationAccessWhere(currentUserId),
          include: {
            lot: {
              include: {
                block: {
                  include: {
                    development: true,
                  },
                },
              },
            },
            sale: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        sales: {
          where: saleAccessWhere(currentUserId),
          include: {
            lot: {
              include: {
                block: {
                  include: {
                    development: true,
                  },
                },
              },
            },
            reservation: true,
            contract: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        proposals: {
          where: proposalAccessWhere(currentUserId),
          include: {
            lot: {
              include: {
                block: {
                  include: {
                    development: true,
                  },
                },
              },
            },
            reservation: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    return NextResponse.json(client)
  } catch (error) {
    console.error('GET /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const currentUserId = auth.session.user.id

    const { id } = await params
    const data = await req.json()
    const memberships: { developmentId: string; roleId: string }[] = data.memberships ?? []
    const canAccessClient = await prisma.user.findFirst({
      where: {
        id,
        ...userAccessWhere(currentUserId),
      },
      select: { id: true },
    })
    if (!canAccessClient) return forbiddenResponse()

    const canAssignMemberships = await hasAccessToAllDevelopments(
      currentUserId,
      memberships.map((membership) => membership.developmentId),
    )
    if (!canAssignMemberships) return forbiddenResponse()

    await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf || null,
        rg: data.rg || null,
        address: data.address || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        profession: data.profession || null,
        birthplace: data.birthplace || null,
        maritalStatus: data.maritalStatus || null,
      },
    })

    const accessibleDevelopmentIds = await getAccessibleDevelopmentIds(currentUserId)
    const existing = await prisma.developmentUser.findMany({
      where: {
        userId: id,
        developmentId: {
          in: accessibleDevelopmentIds,
        },
      },
    })
    for (const du of existing) {
      await prisma.developmentUserRole.deleteMany({ where: { developmentUserId: du.id } })
    }
    await prisma.developmentUser.deleteMany({
      where: {
        userId: id,
        developmentId: {
          in: accessibleDevelopmentIds,
        },
      },
    })

    for (const m of memberships) {
      if (!m.developmentId) continue
      const devUser = await prisma.developmentUser.create({
        data: { developmentId: m.developmentId, userId: id },
      })
      if (m.roleId) {
        await prisma.developmentUserRole.create({
          data: { developmentUserId: devUser.id, roleId: m.roleId },
        })
      }
    }

    const user = await prisma.user.findUnique({ where: { id }, include: membershipInclude(currentUserId) })
    return NextResponse.json(user)
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
    console.error('PUT /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Erro ao atualizar usuario.' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const currentUserId = auth.session.user.id

    const { id } = await params
    if (id === currentUserId) {
      return NextResponse.json({ error: 'Voce nao pode excluir seu proprio usuario.' }, { status: 400 })
    }

    const accessibleDevelopmentIds = await getAccessibleDevelopmentIds(currentUserId)
    const client = await prisma.user.findFirst({
      where: {
        id,
        ...userAccessWhere(currentUserId),
      },
      select: { id: true },
    })
    if (!client) return forbiddenResponse()

    const inaccessibleMembershipCount = await prisma.developmentUser.count({
      where: {
        userId: id,
        developmentId: {
          notIn: accessibleDevelopmentIds,
        },
      },
    })
    if (inaccessibleMembershipCount > 0) return forbiddenResponse()

    const existing = await prisma.developmentUser.findMany({ where: { userId: id } })
    for (const du of existing) {
      await prisma.developmentUserRole.deleteMany({ where: { developmentUserId: du.id } })
    }
    await prisma.developmentUser.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('DELETE /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Erro ao excluir usuario.' }, { status: 500 })
  }
}
