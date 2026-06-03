type ContractSettings = {
  sellerName?: string | null
  sellerDocument?: string | null
  sellerAddress?: string | null
  sellerRepresentatives?: string | null
  propertyDescription?: string | null
  acquisitionDescription?: string | null
  paymentInstructions?: string | null
  jurisdiction?: string | null
  additionalClauses?: string | null
}

type ContractData = {
  contractNumber: string
  sale: any
  generatedAt: Date
  settings?: ContractSettings | null
}

const fallbackSettings: Required<ContractSettings> = {
  sellerName: 'Vendedor nao configurado',
  sellerDocument: 'Documento nao configurado',
  sellerAddress: 'Endereco nao configurado',
  sellerRepresentatives: '',
  propertyDescription: 'Descricao do empreendimento nao configurada.',
  acquisitionDescription: 'Historico de aquisicao nao configurado.',
  paymentInstructions: 'Instrucao de pagamento nao configurada.',
  jurisdiction: 'Foro nao configurado',
  additionalClauses: '',
}

export function generateContractNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')

  return `CT${year}${month}${day}${time}${random}`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return 'data nao informada'
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatCpf(value?: string | null) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return value || 'CPF nao informado'
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function nl2br(value?: string | null) {
  return escapeHtml(value || '').replace(/\n/g, '<br />')
}

function resolveSettings(settings?: ContractSettings | null): Required<ContractSettings> {
  return {
    sellerName: settings?.sellerName || fallbackSettings.sellerName,
    sellerDocument: settings?.sellerDocument || fallbackSettings.sellerDocument,
    sellerAddress: settings?.sellerAddress || fallbackSettings.sellerAddress,
    sellerRepresentatives: settings?.sellerRepresentatives || fallbackSettings.sellerRepresentatives,
    propertyDescription: settings?.propertyDescription || fallbackSettings.propertyDescription,
    acquisitionDescription: settings?.acquisitionDescription || fallbackSettings.acquisitionDescription,
    paymentInstructions: settings?.paymentInstructions || fallbackSettings.paymentInstructions,
    jurisdiction: settings?.jurisdiction || fallbackSettings.jurisdiction,
    additionalClauses: settings?.additionalClauses || fallbackSettings.additionalClauses,
  }
}

export function getMissingContractFields(settings?: ContractSettings | null) {
  const requiredFields: Array<[keyof ContractSettings, string]> = [
    ['sellerName', 'Nome do vendedor'],
    ['sellerDocument', 'Documento do vendedor'],
    ['sellerAddress', 'Endereco do vendedor'],
    ['propertyDescription', 'Descricao do empreendimento'],
    ['paymentInstructions', 'Instrucoes de pagamento'],
    ['jurisdiction', 'Foro'],
  ]

  return requiredFields
    .filter(([key]) => !String(settings?.[key] || '').trim())
    .map(([, label]) => label)
}

export function getMissingBuyerFields(user: any) {
  const requiredFields = [
    ['cpf', 'CPF'],
    ['rg', 'RG'],
    ['address', 'Endereco'],
    ['birthDate', 'Data de nascimento'],
    ['profession', 'Profissao'],
    ['birthplace', 'Naturalidade'],
    ['maritalStatus', 'Estado civil'],
  ]

  return requiredFields
    .filter(([key]) => !String(user?.[key] || '').trim())
    .map(([, label]) => label)
}

export function generateContractHTML(data: ContractData): string {
  const { contractNumber, sale, generatedAt } = data
  const settings = resolveSettings(data.settings)
  const user = sale.user
  const lot = sale.lot
  const developmentName = lot.block.development?.name ?? 'empreendimento'
  const remainingValue = Math.max(sale.totalValue - sale.downPayment, 0)
  const firstDueDate = sale.firstDueDate ? formatDate(sale.firstDueDate) : 'data a definir'
  const correction = sale.annualAdjustment ? 'com reajuste anual conforme regras comerciais pactuadas' : 'sem reajuste anual'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato ${escapeHtml(contractNumber)}</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #111827; font-family: Georgia, 'Times New Roman', serif; }
    .page { max-width: 860px; margin: 0 auto; background: #fff; padding: 48px; line-height: 1.7; }
    h1 { font-size: 20px; text-align: center; text-transform: uppercase; margin: 0 0 32px; }
    h2 { font-size: 15px; margin: 28px 0 10px; text-transform: uppercase; }
    p { margin: 0 0 14px; text-align: justify; }
    .signatures { margin-top: 56px; display: grid; gap: 40px; }
    .signature { text-align: center; }
    .line { border-top: 1px solid #111827; padding-top: 8px; margin: 0 auto; max-width: 360px; }
    .muted { color: #6b7280; font-size: 12px; text-align: center; }
    @media print { body { background: #fff; } .page { padding: 0; max-width: none; } }
  </style>
</head>
<body>
  <main class="page">
    <h1>Contrato particular de promessa de compra e venda de imóvel</h1>

    <p>Por este instrumento particular, as partes abaixo identificadas ajustam a promessa de compra e venda de lote integrante do empreendimento ${escapeHtml(developmentName)}.</p>

    <p><strong>Promitente vendedor:</strong> ${escapeHtml(settings.sellerName)}, documento ${escapeHtml(settings.sellerDocument)}, com endereço em ${escapeHtml(settings.sellerAddress)}.</p>

    <p><strong>Promitente comprador:</strong> ${escapeHtml(user.name)}, ${escapeHtml(user.maritalStatus || 'estado civil nao informado')}, ${escapeHtml(user.profession || 'profissao nao informada')}, natural de ${escapeHtml(user.birthplace || 'naturalidade nao informada')}, RG ${escapeHtml(user.rg || 'nao informado')}, CPF ${escapeHtml(formatCpf(user.cpf))}, residente em ${escapeHtml(user.address || 'endereco nao informado')}, email ${escapeHtml(user.email)}.</p>

    <h2>Cláusula primeira: Do empreendimento</h2>
    <p>${nl2br(settings.propertyDescription)}</p>

    <h2>Cláusula segunda: Da origem e regularidade</h2>
    <p>${nl2br(settings.acquisitionDescription)}</p>

    <h2>Cláusula terceira: Do objeto</h2>
    <p>O vendedor promete vender ao comprador o lote ${escapeHtml(lot.identifier)} da quadra ${escapeHtml(lot.block.identifier)}, com área total de ${Number(lot.totalArea).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m², frente de ${Number(lot.front).toLocaleString('pt-BR')} m, fundo de ${Number(lot.back).toLocaleString('pt-BR')} m, lateral esquerda de ${Number(lot.leftSide).toLocaleString('pt-BR')} m e lateral direita de ${Number(lot.rightSide).toLocaleString('pt-BR')} m.</p>

    <h2>Cláusula quarta: Do preço e pagamento</h2>
    <p>O valor total da venda é de <strong>${formatCurrency(sale.totalValue)}</strong>. O comprador pagará entrada de <strong>${formatCurrency(sale.downPayment)}</strong> e o saldo de <strong>${formatCurrency(remainingValue)}</strong> em ${sale.installmentCount} parcela(s) de <strong>${formatCurrency(sale.installmentValue)}</strong>, com primeiro vencimento em ${firstDueDate}, ${correction}.</p>
    <p>${nl2br(settings.paymentInstructions)}</p>

    <h2>Cláusula quinta: Das obrigações das partes</h2>
    <p>O comprador declara conhecer a localização, dimensões e condições do lote, comprometendo-se a pagar as parcelas nas datas pactuadas. O vendedor compromete-se a cumprir as obrigações relacionadas ao empreendimento e à futura outorga dos instrumentos cabíveis, observadas as condições deste contrato.</p>

    <h2>Cláusula sexta: Inadimplência</h2>
    <p>O atraso no pagamento poderá gerar multa, juros, correção e demais encargos previstos nas regras comerciais do empreendimento e na legislação aplicável.</p>

    ${settings.additionalClauses ? `<h2>Cláusulas adicionais</h2><p>${nl2br(settings.additionalClauses)}</p>` : ''}

    <h2>Cláusula final: Do foro</h2>
    <p>As partes elegem o foro de ${escapeHtml(settings.jurisdiction)} para dirimir dúvidas oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

    <p style="text-align:center; margin-top: 36px;">${escapeHtml(settings.jurisdiction)} - ${formatDate(generatedAt)}</p>

    <section class="signatures">
      <div class="signature">
        <div class="line"><strong>${escapeHtml(settings.sellerName)}</strong><br />${escapeHtml(settings.sellerDocument)}</div>
        ${settings.sellerRepresentatives ? `<p class="muted">${nl2br(settings.sellerRepresentatives)}</p>` : ''}
      </div>
      <div class="signature">
        <div class="line"><strong>${escapeHtml(user.name)}</strong><br />CPF ${escapeHtml(formatCpf(user.cpf))}</div>
      </div>
      <div class="signature">
        <div class="line"><strong>Testemunha 1</strong></div>
      </div>
      <div class="signature">
        <div class="line"><strong>Testemunha 2</strong></div>
      </div>
    </section>

    <p class="muted">Contrato nº ${escapeHtml(contractNumber)} · gerado pelo Lotiva em ${formatDate(generatedAt)}</p>
  </main>
</body>
</html>`
}

export function generateContractPDFHTML(data: ContractData): string {
  return generateContractHTML(data)
}
