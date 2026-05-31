import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  blockAccessWhere,
  contractAccessWhere,
  lotAccessWhere,
  membershipWhere,
  saleAccessWhere,
  userAccessWhere,
} from '@/lib/access-control'
import { prisma } from '@/lib/prisma'

type ChecklistItem = {
  id: string
  title: string
  description: string
  href: string
  status: 'complete' | 'action' | 'pending'
  metric: string
}

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const [
    companyCount,
    developmentCount,
    userCount,
    blockCount,
    lotCount,
    saleCount,
    contractCount,
    emailedContractCount,
  ] = await Promise.all([
    prisma.company.count({
      where: {
        OR: [
          { developments: { some: membershipWhere(userId) } },
          { developments: { none: {} } },
        ],
      },
    }),
    prisma.development.count({ where: membershipWhere(userId) }),
    prisma.user.count({ where: userAccessWhere(userId) }),
    prisma.block.count({ where: blockAccessWhere(userId) }),
    prisma.lot.count({ where: lotAccessWhere(userId) }),
    prisma.sale.count({ where: saleAccessWhere(userId) }),
    prisma.contract.count({ where: contractAccessWhere(userId) }),
    prisma.contract.count({
      where: {
        ...contractAccessWhere(userId),
        emailSent: true,
      },
    }),
  ])

  const checklist: ChecklistItem[] = [
    {
      id: 'company',
      title: 'Create company profile',
      description: 'Register the legal company or developer that owns the portfolio.',
      href: '/companies',
      status: companyCount > 0 ? 'complete' : 'action',
      metric: `${companyCount} companies`,
    },
    {
      id: 'development',
      title: 'Create first development',
      description: 'Attach each loteamento or project to the correct company.',
      href: '/developments',
      status: developmentCount > 0 ? 'complete' : companyCount > 0 ? 'action' : 'pending',
      metric: `${developmentCount} developments`,
    },
    {
      id: 'users',
      title: 'Invite users and clients',
      description: 'Add admins, brokers, owners, and buyers with their development roles.',
      href: '/clients',
      status: userCount > 0 ? 'complete' : developmentCount > 0 ? 'action' : 'pending',
      metric: `${userCount} users`,
    },
    {
      id: 'inventory',
      title: 'Build lot inventory',
      description: 'Create blocks and lots with dimensions, prices, and availability.',
      href: '/lots',
      status: blockCount > 0 && lotCount > 0 ? 'complete' : developmentCount > 0 ? 'action' : 'pending',
      metric: `${blockCount} blocks / ${lotCount} lots`,
    },
    {
      id: 'contract',
      title: 'Validate contract generation',
      description: 'Run a test sale to confirm legal buyer data, pricing, and generated contract output.',
      href: '/sales',
      status: contractCount > 0 ? 'complete' : lotCount > 0 && userCount > 0 ? 'action' : 'pending',
      metric: `${contractCount} contracts`,
    },
    {
      id: 'email',
      title: 'Test contract delivery',
      description: 'Send at least one generated contract by email to verify SMTP and PDF delivery.',
      href: '/sales',
      status: emailedContractCount > 0 ? 'complete' : contractCount > 0 ? 'action' : 'pending',
      metric: `${emailedContractCount} emailed`,
    },
  ]

  const completedCount = checklist.filter((item) => item.status === 'complete').length
  const progress = Math.round((completedCount / checklist.length) * 100)
  const readyForSales = completedCount === checklist.length

  return NextResponse.json({
    progress,
    readyForSales,
    completedCount,
    totalCount: checklist.length,
    counts: {
      companies: companyCount,
      developments: developmentCount,
      users: userCount,
      blocks: blockCount,
      lots: lotCount,
      sales: saleCount,
      contracts: contractCount,
      emailedContracts: emailedContractCount,
    },
    checklist,
  })
}
