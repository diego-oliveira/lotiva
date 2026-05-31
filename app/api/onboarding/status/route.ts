import { NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth'
import {
  blockAccessWhere,
  lotAccessWhere,
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
    pricedLotCount,
    availableLotCount,
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
    prisma.lot.count({
      where: {
        ...lotAccessWhere(userId),
        price: { gt: 0 },
        totalArea: { gt: 0 },
        front: { gt: 0 },
        back: { gt: 0 },
        leftSide: { gt: 0 },
        rightSide: { gt: 0 },
      },
    }),
    prisma.lot.count({ where: { ...lotAccessWhere(userId), status: 'available' } }),
  ])

  const checklist: ChecklistItem[] = [
    {
      id: 'company',
      title: 'Cadastrar empresa proprietaria',
      description: 'Registre a empresa, incorporadora ou loteadora responsavel pelo empreendimento.',
      href: '/onboarding',
      status: companyCount > 0 ? 'complete' : 'action',
      metric: `${companyCount} empresas`,
    },
    {
      id: 'development',
      title: 'Cadastrar empreendimento',
      description: 'Crie o loteamento dentro da empresa correta para organizar quadras, lotes e vendas.',
      href: '/onboarding',
      status: developmentCount > 0 ? 'complete' : companyCount > 0 ? 'action' : 'pending',
      metric: `${developmentCount} empreendimentos`,
    },
    {
      id: 'inventory',
      title: 'Criar quadras e lotes iniciais',
      description: 'Monte o estoque inicial com quadras e lotes para iniciar a operacao comercial.',
      href: '/onboarding',
      status: blockCount > 0 && lotCount > 0 ? 'complete' : developmentCount > 0 ? 'action' : 'pending',
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
    checklist,
  })
}
