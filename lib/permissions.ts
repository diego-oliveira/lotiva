import { prisma } from './prisma'

export type AppPermission = 'admin' | 'manageSettings' | 'manageUsers' | 'sales' | 'finance'

const roleAliases: Record<string, AppPermission[]> = {
  owner: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance'],
  administrador: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance'],
  admin: ['admin', 'manageSettings', 'manageUsers', 'sales', 'finance'],
  gestor: ['manageSettings', 'manageUsers', 'sales', 'finance'],
  manager: ['manageSettings', 'manageUsers', 'sales', 'finance'],
  vendedor: ['sales'],
  sales: ['sales'],
  financeiro: ['finance'],
  finance: ['finance'],
}

const permissionRoleNames: Record<AppPermission, string[]> = {
  admin: ['owner', 'administrador', 'admin'],
  manageSettings: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  manageUsers: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
  sales: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'vendedor', 'sales'],
  finance: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
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
  const memberships = await prisma.developmentUser.findMany({
    where: { userId },
    include: {
      roles: { include: { role: true } },
    },
  })

  const roleNames = memberships.flatMap((membership) => membership.roles.map((assignment) => assignment.role.name))
  const permissions = buildPermissions(roleNames)

  return {
    roles: [...new Set(roleNames)],
    permissions: {
      admin: permissions.has('admin'),
      manageSettings: permissions.has('manageSettings'),
      manageUsers: permissions.has('manageUsers'),
      sales: permissions.has('sales'),
      finance: permissions.has('finance'),
    },
  }
}

export async function hasAnyDevelopmentPermission(userId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]

  const membership = await prisma.developmentUser.findFirst({
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
  })

  return Boolean(membership)
}

export async function hasDevelopmentPermission(userId: string, developmentId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]

  const membership = await prisma.developmentUser.findUnique({
    where: {
      developmentId_userId: {
        developmentId,
        userId,
      },
    },
    include: {
      roles: { include: { role: true } },
    },
  })

  if (!membership) return false
  return hasPermissionFromRoles(membership.roles.map((assignment) => assignment.role.name), permission)
}

export async function hasCompanyPermission(userId: string, companyId: string, permission: AppPermission) {
  const roleNames = permissionRoleNames[permission]
  const membership = await prisma.developmentUser.findFirst({
    where: {
      userId,
      development: { companyId },
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
  })

  return Boolean(membership)
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
