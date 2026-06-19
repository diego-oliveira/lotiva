import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  membershipWhere,
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

export async function GET(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id
  const requestedDevelopmentId = new URL(req.url).searchParams.get('developmentId')

  const [
    companies,
    developmentCount,
    userCount,
    primaryDevelopment,
  ] = await Promise.all([
    prisma.company.findMany({
      where: {
        OR: [
          { developments: { some: membershipWhere(userId) } },
          { developments: { none: {} } },
        ],
      },
      select: { id: true, name: true, logo: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.development.count({ where: membershipWhere(userId) }),
    prisma.user.count({ where: userAccessWhere(userId) }),
    requestedDevelopmentId
      ? prisma.development.findFirst({
          where: {
            ...membershipWhere(userId),
            id: requestedDevelopmentId,
          },
          include: {
            company: true,
            blocks: {
              include: {
                _count: {
                  select: { lots: true },
                },
                lots: {
                  orderBy: { createdAt: 'asc' },
                  take: 1,
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : Promise.resolve(null),
  ])

  const setupCompany = primaryDevelopment?.company ?? companies[0] ?? null
  const firstLot = primaryDevelopment?.blocks.find((block) => block.lots.length > 0)?.lots[0] ?? null
  const firstBlockLotCount = primaryDevelopment?.blocks[0]?._count.lots ?? null
  const companyCount = companies.length
  const blockCount = primaryDevelopment?.blocks.length ?? 0
  const lotCount = primaryDevelopment?.blocks.reduce((sum, block) => sum + block._count.lots, 0) ?? 0
  const pricedLotCount = primaryDevelopment
    ? await prisma.lot.count({
        where: {
          block: { developmentId: primaryDevelopment.id },
          price: { gt: 0 },
          totalArea: { gt: 0 },
          front: { gt: 0 },
          back: { gt: 0 },
          leftSide: { gt: 0 },
          rightSide: { gt: 0 },
        },
      })
    : 0
  const availableLotCount = primaryDevelopment
    ? await prisma.lot.count({ where: { block: { developmentId: primaryDevelopment.id }, status: 'available' } })
    : 0

  const checklist: ChecklistItem[] = [
    {
      id: 'company',
      title: 'Selecionar empresa proprietaria',
      description: 'Use a empresa ja criada pela Lotiva como proprietaria do empreendimento.',
      href: '/companies',
      status: companyCount > 0 ? 'complete' : 'action',
      metric: `${companyCount} empresas`,
    },
    {
      id: 'development',
      title: requestedDevelopmentId ? 'Atualizar empreendimento' : 'Criar empreendimento',
      description: 'Crie cada loteamento dentro da empresa correta para organizar quadras, lotes e vendas.',
      href: '/developments',
      status: primaryDevelopment ? 'complete' : companyCount > 0 ? 'action' : 'pending',
      metric: requestedDevelopmentId
        ? primaryDevelopment?.name ?? 'Empreendimento nao encontrado'
        : `${developmentCount} empreendimentos existentes`,
    },
    {
      id: 'inventory',
      title: 'Criar quadras e lotes iniciais',
      description: 'Monte o estoque inicial com quadras e lotes para iniciar a operacao comercial.',
      href: '/developments',
      status: blockCount > 0 && lotCount > 0 ? 'complete' : primaryDevelopment ? 'action' : 'pending',
      metric: `${blockCount} quadras / ${lotCount} lotes`,
    },
    {
      id: 'pricing',
      title: 'Validar preco e dimensoes',
      description: 'Confirme que os lotes possuem area, medidas e valor para aparecerem na venda.',
      href: '/lots',
      status: lotCount > 0 && pricedLotCount === lotCount ? 'complete' : lotCount > 0 ? 'action' : 'pending',
      metric: `${pricedLotCount} de ${lotCount} completos`,
    },
    {
      id: 'availability',
      title: 'Liberar lotes disponiveis',
      description: 'Mantenha pelo menos um lote disponivel para a equipe comercial consultar e vender.',
      href: '/lots',
      status: availableLotCount > 0 ? 'complete' : lotCount > 0 ? 'action' : 'pending',
      metric: `${availableLotCount} disponiveis`,
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
      pricedLots: pricedLotCount,
      availableLots: availableLotCount,
    },
    setup: {
      companies,
      company: setupCompany
        ? {
            id: setupCompany.id,
            name: setupCompany.name,
            logo: setupCompany.logo,
          }
        : null,
      development: primaryDevelopment
        ? {
            id: primaryDevelopment.id,
            name: primaryDevelopment.name,
            logo: primaryDevelopment.logo,
            companyId: primaryDevelopment.companyId,
          }
        : null,
      inventory: {
        blockCount: primaryDevelopment?.blocks.length ?? null,
        lotsPerBlock: firstBlockLotCount,
        lotArea: firstLot?.totalArea ?? null,
        lotFront: firstLot?.front ?? null,
        lotBack: firstLot?.back ?? null,
        lotLeftSide: firstLot?.leftSide ?? null,
        lotRightSide: firstLot?.rightSide ?? null,
        lotPrice: firstLot?.price ?? null,
        initialStatus: firstLot?.status ?? null,
      },
    },
    checklist,
  })
}
