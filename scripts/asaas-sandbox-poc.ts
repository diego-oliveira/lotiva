import { randomUUID } from 'crypto'
import { loadEnvConfig } from '@next/env'
import { AsaasPaymentProvider } from '../lib/payments/asaas-provider'

loadEnvConfig(process.cwd())

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Defina ${name} antes de executar a POC.`)
  return value
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

async function main() {
  const provider = new AsaasPaymentProvider(required('ASAAS_API_KEY'), 'sandbox')
  const cpfCnpj = required('ASAAS_POC_CPF_CNPJ')
  const runId = randomUUID()
  const keepCharges = process.env.ASAAS_POC_KEEP === 'true'

  const customer = await provider.findCustomerByDocument(cpfCnpj)
    ?? await provider.createCustomer({
      name: process.env.ASAAS_POC_NAME || 'Cliente Sandbox Lotiva',
      cpfCnpj,
      email: process.env.ASAAS_POC_EMAIL,
      externalReference: `lotiva-poc-customer-${cpfCnpj}`,
      notificationDisabled: true,
    })

  console.log(`Cliente sandbox: ${customer.id}`)

  const firstDueDate = addMonths(new Date(), 1)
  const charges = []
  for (let index = 0; index < 12; index += 1) {
    const sequence = index + 1
    const charge = await provider.createCharge({
      customerId: customer.id,
      amount: process.env.ASAAS_POC_AMOUNT || '5.00',
      dueDate: dateOnly(addMonths(firstDueDate, index)),
      billingType: 'BOLETO',
      description: `POC Lotiva - parcela ${sequence}/12`,
      externalReference: `lotiva-poc-${runId}-${sequence}`,
      interest: { percentage: '1' },
      fine: { percentage: '2' },
    })
    charges.push(charge)
    console.log(`Parcela ${sequence}: ${charge.id} - ${charge.status} - ${charge.dueDate}`)
  }

  const firstCharge = await provider.getCharge(charges[0].id)
  console.log(`Consulta da primeira cobranca: ${firstCharge.id} - ${firstCharge.status}`)

  try {
    const pix = await provider.getPixQrCode(firstCharge.id)
    console.log(`Pix disponivel: payload com ${pix.payload.length} caracteres`)
  } catch (error) {
    console.warn(`Pix nao retornado para o boleto sandbox: ${error instanceof Error ? error.message : error}`)
  }

  if (!keepCharges) {
    for (const charge of charges) {
      await provider.cancelCharge(charge.id)
    }
    console.log('Cobrancas de teste canceladas. Use ASAAS_POC_KEEP=true para mante-las.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
