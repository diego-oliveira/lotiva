import { NextResponse } from 'next/server'
import { prisma } from './prisma'

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function membershipWhere(userId: string) {
  return {
    memberships: {
      some: {
        userId,
      },
    },
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

export function saleAccessWhere(userId: string) {
  return {
    lot: lotAccessWhere(userId),
  }
}

export function reservationAccessWhere(userId: string) {
  return {
    lot: lotAccessWhere(userId),
  }
}

export function proposalAccessWhere(userId: string) {
  return {
    lot: lotAccessWhere(userId),
  }
}

export function contractAccessWhere(userId: string) {
  return {
    sale: saleAccessWhere(userId),
  }
}

export function companyAccessWhere(userId: string) {
  return {
    developments: {
      some: membershipWhere(userId),
    },
  }
}

export function userAccessWhere(userId: string) {
  return {
    memberships: {
      some: {
        development: membershipWhere(userId),
      },
    },
  }
}

export async function getAccessibleDevelopmentIds(userId: string) {
  const memberships = await prisma.developmentUser.findMany({
    where: { userId },
    select: { developmentId: true },
  })

  return memberships.map((membership) => membership.developmentId)
}

export async function hasAccessToDevelopment(userId: string, developmentId: string) {
  const membership = await prisma.developmentUser.findUnique({
    where: {
      developmentId_userId: {
        developmentId,
        userId,
      },
    },
    select: { id: true },
  })

  return Boolean(membership)
}

export async function hasAccessToAllDevelopments(userId: string, developmentIds: string[]) {
  const uniqueDevelopmentIds = [...new Set(developmentIds.filter(Boolean))]
  if (uniqueDevelopmentIds.length === 0) return true

  const count = await prisma.developmentUser.count({
    where: {
      userId,
      developmentId: {
        in: uniqueDevelopmentIds,
      },
    },
  })

  return count === uniqueDevelopmentIds.length
}
