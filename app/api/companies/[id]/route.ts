import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { companyAccessWhere, forbiddenResponse, membershipWhere } from '@/lib/access-control'
import { isValidUploadedImagePath } from '@/lib/uploadStorage'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params

  const company = await prisma.company.findFirst({
    where: {
      id,
      ...companyAccessWhere(userId),
    },
    include: {
      _count: {
        select: {
          developments: {
            where: membershipWhere(userId),
          },
        },
      },
    },
  })

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json(company)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const userId = auth.session.user.id

  const { id } = await params
  const data = await req.json()
  const companyData = normalizeCompanyData(data)
  if (!companyData.name) {
    return NextResponse.json({ error: 'Informe o nome da empresa.' }, { status: 400 })
  }
  const logo = String(data.logo || '').trim()
  if (logo && !isValidUploadedImagePath(logo)) {
    return NextResponse.json({ error: 'Envie uma imagem valida para o logo.' }, { status: 400 })
  }
  const company = await prisma.company.findFirst({
    where: {
      id,
      ...companyAccessWhere(userId),
    },
    select: { id: true },
  })
  if (!company) return forbiddenResponse()

  const updated = await prisma.company.update({
    where: { id },
    data: {
      logo,
      ...companyData,
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}
