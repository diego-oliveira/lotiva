import { contractAccessWhere } from '@/lib/access-control'
import {
  createAutentiqueDocument,
  deriveAutentiqueStatus,
  getAutentiqueDocument,
  getAutentiqueEnvironment,
  mergeAutentiqueSignerStatus,
  type AutentiqueSignerInput,
} from '@/lib/autentique'
import { requireAuthenticatedUser } from '@/lib/auth'
import { convertDocxToPdf } from '@/lib/docxDocuments'
import { readDocumentFile, saveDocumentFile } from '@/lib/documentStorage'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
type Params = { params: Promise<{ saleId: string }> }

async function getContract(saleId: string, userId: string) {
  return prisma.contract.findFirst({
    where: { saleId, ...contractAccessWhere(userId) },
    include: {
      sale: {
        include: {
          user: true,
          participants: { include: { user: true } },
          createdBy: true,
          lot: { include: { block: { include: { development: { include: { company: true } } } } } },
        },
      },
    },
  })
}

async function getPdf(contract: NonNullable<Awaited<ReturnType<typeof getContract>>>) {
  if (contract.pdfPath) return readDocumentFile(contract.pdfPath)
  const pdf = await convertDocxToPdf(await readDocumentFile(contract.docxPath))
  const pdfPath = await saveDocumentFile(pdf, 'contracts', 'pdf')
  await prisma.contract.update({ where: { id: contract.id }, data: { pdfPath } })
  return pdf
}

function buildSigners(contract: NonNullable<Awaited<ReturnType<typeof getContract>>>, includeBrokerWitness: boolean) {
  const company = contract.sale.lot.block.development?.company
  if (!company) throw new Error('A venda nao possui empresa vendedora vinculada.')
  const signers: AutentiqueSignerInput[] = [
    { name: contract.sale.user.name, email: contract.sale.user.email, action: 'SIGN', role: 'buyer' },
    ...contract.sale.participants.map((participant) => ({
      name: participant.user.name,
      email: participant.user.email,
      action: 'SIGN' as const,
      role: 'buyer' as const,
    })),
  ]

  if (!company.email?.trim()) throw new Error('Cadastre o email da empresa vendedora antes de enviar para assinatura.')
  signers.push({ name: company.legalName || company.name, email: company.email.trim(), action: 'SIGN', role: 'seller' })

  if (includeBrokerWitness) {
    if (!contract.sale.createdBy?.email) throw new Error('A venda nao possui corretor com email cadastrado.')
    signers.push({
      name: contract.sale.createdBy.name,
      email: contract.sale.createdBy.email,
      action: 'SIGN_AS_A_WITNESS',
      role: 'witness',
    })
  }

  const normalizedEmails = signers.map((signer) => signer.email.trim().toLowerCase())
  if (new Set(normalizedEmails).size !== normalizedEmails.length) {
    throw new Error('Comprador, vendedor e testemunha precisam utilizar emails diferentes.')
  }
  return signers.map((signer) => ({ ...signer, email: signer.email.trim().toLowerCase() }))
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { saleId } = await params

  try {
    const contract = await getContract(saleId, auth.session.user.id)
    if (!contract) return NextResponse.json({ error: 'Contrato nao encontrado.' }, { status: 404 })
    if (contract.signatureDocumentId) {
      return NextResponse.json({ error: 'Este contrato ja foi enviado para assinatura.' }, { status: 409 })
    }

    const body = await request.json().catch(() => ({}))
    const signers = buildSigners(contract, body.includeBrokerWitness === true)
    const remote = await createAutentiqueDocument({
      name: `Contrato ${contract.contractNumber}`,
      pdf: await getPdf(contract),
      signers,
    })
    const signerStatus = mergeAutentiqueSignerStatus(signers, remote.signatures ?? [])
    const now = new Date()
    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'sent_for_signature',
        signatureProvider: 'autentique',
        signatureEnvironment: getAutentiqueEnvironment(),
        signatureDocumentId: remote.id,
        signatureStatus: 'pending',
        signatureSigners: signerStatus,
        signatureSentAt: now,
        events: {
          create: {
            userId: auth.originalSession.user.id,
            type: 'signature_sent',
            title: 'Enviado para assinatura',
            description: `${signers.length} participante(s) receberam a solicitacao pela Autentique.`,
          },
        },
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST contract signature:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nao foi possivel enviar para assinatura.' }, { status: 400 })
  }
}

export async function PATCH(_: Request, { params }: Params) {
  const auth = await requireAuthenticatedUser()
  if (auth.response) return auth.response
  const { saleId } = await params

  try {
    const contract = await getContract(saleId, auth.session.user.id)
    if (!contract) return NextResponse.json({ error: 'Contrato nao encontrado.' }, { status: 404 })
    if (!contract.signatureDocumentId || !Array.isArray(contract.signatureSigners)) {
      return NextResponse.json({ error: 'Contrato ainda nao foi enviado para assinatura.' }, { status: 400 })
    }

    const remote = await getAutentiqueDocument(contract.signatureDocumentId)
    const signers = mergeAutentiqueSignerStatus(contract.signatureSigners as AutentiqueSignerInput[], remote.signatures ?? [])
    const status = deriveAutentiqueStatus(signers)
    const signedUrl = remote.files?.signed ?? remote.files?.pades ?? null
    const changed = status !== contract.signatureStatus
    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: status === 'signed' ? 'signed' : status === 'rejected' ? 'signature_rejected' : 'sent_for_signature',
        signatureStatus: status,
        signatureSigners: signers,
        signatureSignedUrl: signedUrl,
        signatureCompletedAt: status === 'signed' ? new Date() : null,
        ...(changed ? {
          events: {
            create: {
              userId: auth.originalSession.user.id,
              type: `signature_${status}`,
              title: status === 'signed' ? 'Contrato assinado' : status === 'rejected' ? 'Assinatura recusada' : 'Assinaturas atualizadas',
              description: `${signers.filter((signer) => signer.signedAt).length} de ${signers.length} participante(s) assinaram.`,
            },
          },
        } : {}),
      },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH contract signature:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nao foi possivel atualizar as assinaturas.' }, { status: 400 })
  }
}
