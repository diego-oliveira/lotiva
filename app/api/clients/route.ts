// app/api/clients/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const clients = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(clients)
}

export async function POST(req: Request) {
  const data = await req.json()

  try {
    const newClient = await prisma.user.create({
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
  } catch (error: any) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target : []

      if (target.includes('email')) {
        return NextResponse.json(
          { error: 'Este email ja esta cadastrado.' },
          { status: 400 },
        )
      }

      if (target.includes('cpf')) {
        return NextResponse.json(
          { error: 'Este CPF ja esta cadastrado.' },
          { status: 400 },
        )
      }

      return NextResponse.json(
        { error: 'Ja existe um usuario com estes dados.' },
        { status: 400 },
      )
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Erro ao salvar usuario.' },
      { status: 500 },
    )
  }
}
