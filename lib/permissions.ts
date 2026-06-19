import { prisma } from './prisma'

export type AppPermission =
  | 'admin'
  | 'manageSettings'
  | 'manageUsers'
  | 'sales'
  | 'finance'
  | 'connectPayments'
  | 'issuePayments'
  | 'cancelPayments'
  | 'approveAdjustments'
  | 'reconcilePayments'

const roleAliases: Record<string, AppPermission[]> = {
  owner: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance', 'connectPayments', 'issuePayments', 'cancelPayments', 'approveAdjustments', 'reconcilePayments'],
  administrador: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance', 'connectPayments', 'issuePayments', 'cancelPayments', 'approveAdjustments', 'reconcilePayments'],
  admin: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance', 'connectPayments', 'issuePayments', 'cancelPayments', 'approveAdjustments', 'reconcilePayments'],
  gestor: ['manageSettings', 'manageUsers', 'sales', 'finance', 'connectPayments', 'issuePayments', 'cancelPayments', 'approveAdjustments', 'reconcilePayments'],
  manager: ['manageSettings', 'manageUsers', 'sales', 'finance', 'connectPayments', 'issuePayments', 'cancelPayments', 'approveAdjustments', 'reconcilePayments'],
  vendedor: ['sales'],
  sales: ['sales'],
  financeiro: ['finance', 'issuePayments', 'cancelPayments', 'reconcilePayments'],
  finance: ['finance', 'issuePayments', 'cancelPayments', 'reconcilePayments'],
}

const permissionRoleNames: Record<AppPermission, string[]> = {
  admin: ['owner', 'administrador', 'admin'],
  manageSettings: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  manageUsers: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  sales: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'vendedor', 'sales'],
  finance: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
  connectPayments: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  issuePayments: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
  cancelPayments: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
  approveAdjustments: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  reconcilePayments: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
}

function normalizeRoleName(name: string) {
  return name.trim().toLowerCase()
}

function buildPermissions(roleNames: string[]) {
  const permissions = new Set<AppPermission>()

  roleNames.forEach((roleName) => {
    const normalized = normalizeRoleName(roleName)
    roleAliases[normalized]?.forEach((permission) => permissions.add(permission))
  })

  return permissions
}

export function hasPermissionFromRoles(roleNames: string[], permission: AppPermission) {
  return buildPermissions(roleNames).has(permission)
}

export async function getUserPermissions(userId: string) {
  const [memberships, companyMemberships, createdCompanyCount] = await Promise.all([
    prisma.developmentUser.findMany({
      where: { userId, development: { deletedAt: null } },
      include: {
        roles: { include: { role: true } },
      },
    }),
    prisma.companyUser.findMany({
      where: { userId },
      include: {
        roles: { include: { role: true } },
      },
    }),
    prisma.company.count({
      where: { createdById: userId },
    }),
  ])

  const roleNames = [
    ...memberships.flatMap((membership) => membership.roles.map((assignment) => assignment.role.name)),
    ...companyMemberships.flatMap((membership) => membership.roles.map((assignment) => assignment.role.name)),
    ...(createdCompanyCount > 0 ? ['owner'] : []),
  ]
  const permissions = buildPermissions(roleNames)

  return {
    roles: [...new Set(roleNames)],
    permissions: {
      admin: permissions.has('admin'),
      manageSettings: permissions.has('manageSettings'),
      manageUsers: permissions.has('manageUsers'),
      sales: permissions.has('sales'),
      finance: permissions.has('finance'),
      connectPayments: permissions.has('connectPayments'),
      issuePayments: permissions.has('issuePayments'),
      cancelPayments: permissions.has('cancelPayments'),
      approveAdjustments: permissions.has('approveAdjustments'),
      reconcilePayments: permissions.has('reconcilePayments'),
    },
  }
}

export async function hasAnyDevelopmentPermission(userId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]

  const [developmentMembership, companyMembership, createdCompany] = await Promise.all([
    prisma.developmentUser.findFirst({
      where: {
        development: { deletedAt: null },
        userId,
        roles: {
          some: {
            role: {
              name: {
                in: roleNames,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.companyUser.findFirst({
      where: {
        userId,
        roles: {
          some: {
            role: {
              name: {
                in: roleNames,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.company.findFirst({
      where: { createdById: userId },
      select: { id: true },
    }),
  ])

  return Boolean(developmentMembership || companyMembership || createdCompany)
}

export async function hasDevelopmentPermission(userId: string, developmentId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]

  const [membership, companyMembership, createdCompany] = await Promise.all([
    prisma.developmentUser.findFirst({
      where: {
        developmentId,
        userId,
        development: { deletedAt: null },
      },
      include: {
        roles: { include: { role: true } },
      },
    }),
    prisma.companyUser.findFirst({
      where: {
        userId,
        company: {
          developments: {
            some: {
              id: developmentId,
              deletedAt: null,
            },
          },
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    }),
    prisma.company.findFirst({
      where: {
        createdById: userId,
        developments: {
          some: {
            id: developmentId,
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    }),
  ])

  const roleNamesForUser = [
    ...(membership?.roles.map((assignment) => assignment.role.name) ?? []),
    ...(companyMembership?.roles.map((assignment) => assignment.role.name) ?? []),
    ...(createdCompany ? ['owner'] : []),
  ]
  return hasPermissionFromRoles(roleNamesForUser, permission)
}

export async function hasCompanyPermission(userId: string, companyId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]
  const [developmentMembership, companyMembership, createdCompany] = await Promise.all([
    prisma.developmentUser.findFirst({
      where: {
        userId,
        development: { companyId, deletedAt: null },
        roles: {
          some: {
            role: {
              name: {
                in: roleNames,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.companyUser.findFirst({
      where: {
        userId,
        companyId,
        roles: {
          some: {
            role: {
              name: {
                in: roleNames,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      select: { id: true },
    }),
    prisma.company.findFirst({
      where: {
        id: companyId,
        createdById: userId,
      },
      select: { id: true },
    }),
  ])

  return Boolean(developmentMembership || companyMembership || createdCompany)
}

export async function ensureBaseRoles() {
  const names = ['Administrador', 'Gestor', 'Vendedor', 'Financeiro']

  await Promise.all(
    names.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  )
}
