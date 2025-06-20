// app/api/clients/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const clients = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const data = await req.json()

  const newClient = await prisma.customer.create({
    data: {
      name: data.name,
      cpf: data.cpf,
      rg: data.rg,
      email: data.email,
      address: data.address,
      birthDate: new Date(data.birthDate),
      profession: data.profession,
      birthplace: data.birthplace,
      maritalStatus: data.maritalStatus,
    },
  })

  return NextResponse.json(newClient, { status: 201 })
}
