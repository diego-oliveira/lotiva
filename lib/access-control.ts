import { NextResponse } from 'next/server'
import { prisma } from './prisma'

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function membershipWhere(userId: string) {
  return {
    deletedAt: null,
    OR: [
      {
        company: {
          createdById: userId,
        },
      },
      {
        memberships: {
          some: {
            userId,
          },
        },
      },
      {
        company: {
          memberships: {
            some: {
              userId,
            },
          },
        },
      },
    ],
  }
}

export function blockAccessWhere(userId: string) {
  return {
    development: membershipWhere(userId),
  }
}

export function lotAccessWhere(userId: string) {
  return {
    block: blockAccessWhere(userId),
  }
}

export function lotEventAccessWhere(userId: string) {
  return {
    AND: [
      {
        lot: lotAccessWhere(userId),
      },
      {
        OR: [
          {
            type: {
              notIn: [
                'proposal_created',
                'proposal_auto_approved',
                'proposal_pending_approval',
                'proposal_approved',
                'proposal_rejected',
              ],
            },
          },
          {
            userId,
          },
          {
            lot: {
              block: {
                development: {
                  memberships: {
                    some: {
                      userId,
                      roles: {
                        some: {
                          role: {
                            name: {
                              in: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
                              mode: 'insensitive' as const,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  }
}

export function saleAccessWhere(userId: string) {
  return {
    AND: [
      {
        lot: lotAccessWhere(userId),
      },
      {
        OR: [
          { createdById: userId },
          {
            lot: {
              block: {
                development: {
                  memberships: {
                    some: {
                      userId,
                      roles: {
                        some: {
                          role: {
                            name: {
                              in: ['owner', 'administrador', 'admin', 'gestor', 'manager', 'financeiro', 'finance'],
                              mode: 'insensitive' as const,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  }
}

export function reservationAccessWhere(userId: string) {
  return {
    lot: lotAccessWhere(userId),
  }
}

export function proposalAccessWhere(userId: string) {
  return {
    AND: [
      {
        lot: lotAccessWhere(userId),
      },
      {
        OR: [
          {
            createdById: userId,
          },
          {
            lot: {
              block: {
                development: {
                  memberships: {
                    some: {
                      userId,
                      roles: {
                        some: {
                          role: {
                            name: {
                              in: ['owner', 'administrador', 'admin', 'gestor', 'manager'],
                              mode: 'insensitive' as const,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    ],
  }
}

export function contractAccessWhere(userId: string) {
  return {
    sale: saleAccessWhere(userId),
  }
}

export function receivableAccessWhere(userId: string) {
  return {
    sale: saleAccessWhere(userId),
  }
}

export function companyAccessWhere(userId: string) {
  return {
    OR: [
      {
        createdById: userId,
      },
      {
        memberships: {
          some: {
            userId,
          },
        },
      },
      {
        developments: {
          some: {
            deletedAt: null,
            memberships: {
              some: {
                userId,
              },
            },
          },
        },
      },
    ],
  }
}

export function documentTemplateAccessWhere(userId: string) {
  return {
    company: companyAccessWhere(userId),
  }
}

export function userAccessWhere(userId: string) {
  return {
    OR: [
      {
        memberships: {
          some: {
            development: membershipWhere(userId),
          },
        },
      },
      {
        companyMemberships: {
          some: {
            company: companyAccessWhere(userId),
          },
        },
      },
    ],
  }
}

export function manageableUserWhere(userId: string) {
  return {
    AND: [
      userAccessWhere(userId),
      {
        createdCompanies: {
          none: {
            createdById: {
              not: userId,
            },
          },
        },
      },
    ],
  }
}

export async function getAccessibleDevelopmentIds(userId: string) {
  const developments = await prisma.development.findMany({
    where: membershipWhere(userId),
    select: { id: true },
  })

  return developments.map((development) => development.id)
}

export async function hasAccessToDevelopment(userId: string, developmentId: string) {
  const development = await prisma.development.findFirst({
    where: {
      id: developmentId,
      ...membershipWhere(userId),
    },
    select: { id: true },
  })

  return Boolean(development)
}

export async function hasAccessToAllDevelopments(userId: string, developmentIds: string[]) {
  const uniqueDevelopmentIds = [...new Set(developmentIds.filter(Boolean))]
  if (uniqueDevelopmentIds.length === 0) return true

  const count = await prisma.development.count({
    where: {
      id: {
        in: uniqueDevelopmentIds,
      },
      ...membershipWhere(userId),
    },
  })

  return count === uniqueDevelopmentIds.length
}

export async function hasAccessToAllCompanies(userId: string, companyIds: string[]) {
  const uniqueCompanyIds = [...new Set(companyIds.filter(Boolean))]
  if (uniqueCompanyIds.length === 0) return true

  const count = await prisma.company.count({
    where: {
      id: {
        in: uniqueCompanyIds,
      },
      ...companyAccessWhere(userId),
    },
  })

  return count === uniqueCompanyIds.length
}
