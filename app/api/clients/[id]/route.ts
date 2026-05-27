// app/api/clients/[id]/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Params) {
  const { id } = await params
  const client = await prisma.user.findUnique({
    where: { id },
  })
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }
  return NextResponse.json(client)
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const data = await req.json()

  try {
    const updated = await prisma.user.update({
      where: { id },
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

    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar usuario.' },
      { status: 500 },
    )
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params
  await prisma.user.delete({
    where: { id },
  })
  return NextResponse.json({ deleted: true })
}
