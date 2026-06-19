import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { companyAccessWhere, membershipWhere } from '@/lib/access-control'
import { isValidUploadedImagePath } from '@/lib/uploadStorage'
import { NextResponse } from 'next/server'

function normalizeCompanyData(data: any) {
  return {
    name: String(data.name || '').trim(),
    legalName: String(data.legalName || '').trim(),
    document: String(data.document || '').trim(),
    stateRegistration: String(data.stateRegistration || '').trim(),
    address: String(data.address || '').trim(),
    city: String(data.city || '').trim(),
    state: String(data.state || '').trim(),
    zipCode: String(data.zipCode || '').trim(),
    phone: String(data.phone || '').trim(),
    email: String(data.email || '').trim(),
  }
}

export async function GET() {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const companies = await prisma.company.findMany({
    where: companyAccessWhere(userId),
    include: {
      _count: {
        select: {
          developments: {
            where: membershipWhere(userId),
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(companies)
}

export async function POST(req: Request) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const data = await req.json()
  const companyData = normalizeCompanyData(data)
  if (!companyData.name) {
    return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 })
  }
  const logo = String(data.logo || '').trim()
  if (logo && !isValidUploadedImagePath(logo)) {
    return NextResponse.json({ error: 'Envie uma imagem valida para o logo.' }, { status: 400 })
  }

  const company = await prisma.company.create({
    data: {
      logo,
      ...companyData,
      createdById: userId,
    },
  })

  return NextResponse.json(company, { status: 201 })
}
