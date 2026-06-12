import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { forbiddenResponse, proposalAccessWhere } from '@/lib/access-control'
import { createLotEvent } from '@/lib/lot-events'
import { hasDevelopmentPermission } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const currentUserId = auth.session.user.id
  const { id } = await params

  try {
    const data = await req.json()
    const action = data.action === 'approve' ? 'approve' : data.action === 'reject' ? 'reject' : null
    if (!action) {
      return NextResponse.json({ error: 'Acao de revisao invalida.' }, { status: 400 })
    }
    if (action === 'reject' && !data.reason?.trim()) {
      return NextResponse.json({ error: 'Informe o motivo da rejeicao.' }, { status: 400 })
    }

    const proposal = await prisma.proposal.findFirst({
      where: { id, ...proposalAccessWhere(currentUserId) },
      include: {
        user: true,
        createdBy: true,
        lot: { include: { block: { include: { development: true } } } },
      },
    })
    const developmentId = proposal?.lot.block.developmentId
    if (!proposal || !developmentId) return forbiddenResponse()
    if (!(await hasDevelopmentPermission(currentUserId, developmentId, 'admin'))) return forbiddenResponse()
    if (proposal.status !== 'pending_approval') {
      return NextResponse.json({ error: 'Esta proposta nao esta aguardando aprovacao.' }, { status: 409 })
    }

    const status = action === 'approve' ? 'approved' : 'rejected'
    const reviewed = await prisma.$transaction(async (tx) => {
      const savedProposal = await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status,
          reviewedById: currentUserId,
          reviewedAt: new Date(),
          rejectionReason: action === 'reject' ? data.reason.trim() : null,
        },
        include: {
          user: true,
          createdBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
          lot: { include: { block: { include: { development: true } } } },
          reservation: true,
        },
      })

      await createLotEvent(tx, {
        lotId: proposal.lotId,
        userId: currentUserId,
        type: action === 'approve' ? 'proposal_approved' : 'proposal_rejected',
        title: action === 'approve' ? 'Proposta aprovada' : 'Proposta rejeitada',
        description: action === 'approve'
          ? `Proposta para ${proposal.user.name} aprovada para continuidade da venda.`
          : `Proposta para ${proposal.user.name} rejeitada.`,
        notes: action === 'reject' ? data.reason.trim() : null,
      })

      await tx.notification.create({
        data: {
          userId: proposal.createdById,
          type: action === 'approve' ? 'proposal_approved' : 'proposal_rejected',
          title: action === 'approve' ? 'Proposta aprovada' : 'Proposta rejeitada',
          message: action === 'approve'
            ? `A proposta de ${proposal.user.name} foi aprovada. Continue com a venda.`
            : `A proposta de ${proposal.user.name} foi rejeitada: ${data.reason.trim()}`,
          href: action === 'approve'
            ? `/sales?lotId=${proposal.lotId}&userId=${proposal.userId}&reservationId=${proposal.reservationId ?? ''}&proposalId=${proposal.id}`
            : `/proposals?proposalId=${proposal.id}`,
        },
      })

      return savedProposal
    })

    return NextResponse.json(reviewed)
  } catch (error) {
    console.error('PATCH /api/proposals/[id]:', error)
    return NextResponse.json({ error: 'Nao foi possivel revisar a proposta.' }, { status: 500 })
  }
}
