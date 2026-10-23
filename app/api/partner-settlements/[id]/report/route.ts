import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@/app/generated/prisma'
import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/auth'
import { financialDevelopmentAccessWhere } from '@/lib/access-control'
import { buildSettlementSnapshot } from '@/lib/partner-settlement-data'
import { createSettlementReportPdf, type SettlementReportInput } from '@/lib/partner-settlement-report'
import { normalizeSnapshot } from '@/lib/partner-settlements'

export const runtime = 'nodejs'
export const maxDuration = 180

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { id } = await params
  const revisionId = req.nextUrl.searchParams.get('revision')
  try {
    const report = await prisma.$transaction(async (tx): Promise<SettlementReportInput | null> => {
      const settlement = await tx.partnerSettlement.findFirst({ where: { id, development: financialDevelopmentAccessWhere(auth.session.user.id) }, include: { development: { select: { name: true } }, payments: { orderBy: [{ paidAt: 'asc' }, { id: 'asc' }] }, _count: { select: { revisions: true } } } })
      if (!settlement) return null
      if (revisionId) {
        const revision = await tx.partnerSettlementRevision.findFirst({ where: { id: revisionId, settlementId: settlement.id } })
        if (!revision) return null
        return { snapshot: normalizeSnapshot(revision.snapshot), payments: revision.payments as unknown as SettlementReportInput['payments'], status: 'archived', version: revision.number, closedAt: revision.closedAt.toISOString(), reason: revision.reason }
      }
      const snapshot = settlement.status === 'closed'
        ? normalizeSnapshot(settlement.snapshot)
        : await buildSettlementSnapshot(tx, settlement.developmentId, settlement.development.name, settlement)
      return { snapshot, payments: settlement.payments.map((item) => ({ participantId: item.participantId, participantName: item.participantName, amount: Number(item.amount), paidAt: item.paidAt.toISOString(), notes: item.notes, proofUrl: item.proofUrl })), status: settlement.status === 'closed' ? 'closed' : 'draft', version: settlement._count.revisions + 1, closedAt: settlement.closedAt?.toISOString() }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    if (!report) return NextResponse.json({ error: 'Demonstrativo não encontrado.' }, { status: 404 })
    const buffer = await createSettlementReportPdf(report)
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Distribuicao_${report.snapshot.month}_v${report.version}${report.status === 'draft' ? '_previa' : ''}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
  } catch (error) {
    console.error('partner_settlement_report_failed', error)
    return NextResponse.json({ error: 'Não foi possível gerar o relatório em PDF. Tente novamente.' }, { status: 500 })
  }
}
