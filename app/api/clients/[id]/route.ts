// app/api/clients/[id]/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: { id: string } }

export async function GET(_: Request, { params }: Params) {
    const client = await prisma.customer.findUnique({
    where: { id: params.id },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  return NextResponse.json(client)
}

export async function PUT(req: Request, { params }: Params) {
  const data = await req.json()

  const updated = await prisma.customer.update({
    where: { id: params.id },
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
      updatedAt: new Date(),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: Request, { params }: Params) {
  await prisma.client.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ deleted: true })
}
