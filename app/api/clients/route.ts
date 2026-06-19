import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, hasAccessToAllCompanies, hasAccessToAllDevelopments, membershipWhere, userAccessWhere } from '@/lib/access-control'
import { hasAnyDevelopmentPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'

async function canUseClientRecords(userId: string) {
  return (
    (await hasAnyDevelopmentPermission(userId, 'manageUsers')) ||
    (await hasAnyDevelopmentPermission(userId, 'sales'))
  )
}

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
  companyMemberships: {
    where: {
      company: {
        OR: [
          { memberships: { some: { userId } } },
          { developments: { some: membershipWhere(userId) } },
        ],
      },
    },
    include: {
      company: true,
      roles: { include: { role: true } },
    },
  },
})

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedUser()
    if (auth.response) return auth.response
    const currentUserId = auth.session.user.id
    const operational = new URL(req.url).searchParams.get('scope') === 'operational'
    const canManageUsers = await hasAnyDevelopmentPermission(currentUserId, 'manageUsers')
    if (!canManageUsers && !(operational && await hasAnyDevelopmentPermission(currentUserId, 'sales'))) {
      return forbiddenResponse()
    }

    const clients = await prisma.user.findMany({
      where: {
        AND: [
          userAccessWhere(currentUserId),
          ...(!canManageUsers && operational ? [{
            memberships: {
              some: {
                development: membershipWhere(currentUserId),
                roles: { none: {} },
              },
            },
          }] : []),
        ],
      },
      include: membershipInclude(currentUserId),
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
    const currentUserId = auth.session.user.id
    if (!(await canUseClientRecords(currentUserId))) return forbiddenResponse()

    const data = await req.json()

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'Nome e obrigatorio.' }, { status: 400 })
    }
    if (!data.email?.trim()) {
      return NextResponse.json({ error: 'Email e obrigatorio.' }, { status: 400 })
    }

    const memberships: { developmentId: string; roleId: string }[] = data.memberships ?? []
    const companyMemberships: { companyId: string; roleId: string }[] = data.companyMemberships ?? []
    const canManageUsers = await hasAnyDevelopmentPermission(currentUserId, 'manageUsers')
    if (!canManageUsers && memberships.some((membership) => membership.roleId)) return forbiddenResponse()
    if (!canManageUsers && companyMemberships.length > 0) return forbiddenResponse()
    if (memberships.length === 0 && companyMemberships.length === 0) {
      return NextResponse.json({ error: 'Selecione pelo menos uma empresa ou empreendimento.' }, { status: 400 })
    }

    const [canAssignMemberships, canAssignCompanyMemberships] = await Promise.all([
      hasAccessToAllDevelopments(
        currentUserId,
        memberships.map((membership) => membership.developmentId),
      ),
      hasAccessToAllCompanies(
        currentUserId,
        companyMemberships.map((membership) => membership.companyId),
      ),
    ])
    if (!canAssignMemberships || !canAssignCompanyMemberships) return forbiddenResponse()

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
    for (const m of companyMemberships) {
      if (!m.companyId || !m.roleId) continue
      const companyUser = await prisma.companyUser.create({
        data: { companyId: m.companyId, userId: newUser.id },
      })
      await prisma.companyUserRole.create({
        data: { companyUserId: companyUser.id, roleId: m.roleId },
      })
    }

    const user = await prisma.user.findUnique({ where: { id: newUser.id }, include: membershipInclude(currentUserId) })
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
