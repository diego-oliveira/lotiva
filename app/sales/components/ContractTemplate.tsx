import React from 'react'

interface Block {
  id: string
  identifier: string
}

interface Lot {
  id: string
  identifier: string
  totalArea: number
  price: number
  front: number
  back: number
  leftSide: number
  rightSide: number
  block: Block
}

interface Customer {
  id: string
  name: string
  email: string
  cpf: string
  rg: string
  address: string
  birthDate: string
  profession: string
  birthplace: string
  maritalStatus: string
}

interface Sale {
  id: string
  installmentCount: number
  installmentValue: number
  downPayment: number
  annualAdjustment: boolean
  totalValue: number
  createdAt: string
  customer: Customer
  lot: Lot
}

interface ContractData {
  contractNumber: string
  sale: Sale
  generatedAt: Date
}

interface ContractTemplateProps {
  data: ContractData
  isPdf?: boolean
}

export default function ContractTemplate({ data, isPdf = false }: ContractTemplateProps) {
  const { contractNumber, sale, generatedAt } = data
  const { customer, lot } = sale

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const contractStyles = isPdf ? {
    container: "max-w-4xl mx-auto p-8 bg-white text-black font-serif leading-relaxed",
    header: "text-center mb-8 border-b-2 border-gray-900 pb-4",
    title: "text-2xl font-bold mb-2 uppercase",
    subtitle: "text-lg mb-4",
    section: "mb-6",
    sectionTitle: "text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1",
    paragraph: "mb-4 text-justify leading-7",
    table: "w-full border-collapse border border-gray-900 mb-4",
    tableHeader: "bg-gray-200 border border-gray-900 p-2 font-bold text-center",
    tableCell: "border border-gray-900 p-2",
    signatureSection: "mt-12 pt-8 border-t-2 border-gray-900",
    signatureLine: "border-b border-gray-900 mb-2 pb-8",
    footer: "mt-12 text-center text-sm text-gray-600"
  } : {
    container: "max-w-4xl mx-auto p-8 bg-white text-gray-900 font-serif leading-relaxed",
    header: "text-center mb-8 border-b-2 border-gray-800 pb-4",
    title: "text-2xl font-bold mb-2 uppercase text-gray-900",
    subtitle: "text-lg mb-4 text-gray-700",
    section: "mb-6",
    sectionTitle: "text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800",
    paragraph: "mb-4 text-justify leading-7 text-gray-800",
    table: "w-full border-collapse border border-gray-800 mb-4",
    tableHeader: "bg-gray-100 border border-gray-800 p-2 font-bold text-center",
    tableCell: "border border-gray-800 p-2",
    signatureSection: "mt-12 pt-8 border-t-2 border-gray-800",
    signatureLine: "border-b border-gray-800 mb-2 pb-8",
    footer: "mt-12 text-center text-sm text-gray-600"
  }

  return (
    <div className={contractStyles.container}>
      {/* Header */}
      <div className={contractStyles.header}>
        <h1 className={contractStyles.title}>
          Contrato de Compra e Venda de Imóvel
        </h1>
        <p className={contractStyles.subtitle}>
          Contrato nº {contractNumber}
        </p>
        <p className="text-sm text-gray-600">
          Gerado em: {formatDate(generatedAt)}
        </p>
      </div>

      {/* Parties Section */}
      <div className={contractStyles.section}>
        <h2 className={contractStyles.sectionTitle}>Das Partes</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold mb-2">VENDEDOR:</h3>
            <p className={contractStyles.paragraph}>
              <strong>LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</strong><br />
              CNPJ: 12.345.678/0001-90<br />
              Endereço: Rua das Empresas, 123 - Centro<br />
              CEP: 12345-678 - Cidade/Estado<br />
              Telefone: (11) 1234-5678<br />
              Email: contato@lotiva.com.br
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">COMPRADOR:</h3>
            <p className={contractStyles.paragraph}>
              <strong>{customer.name.toUpperCase()}</strong><br />
              CPF: {formatCPF(customer.cpf)}<br />
              RG: {customer.rg}<br />
              Endereço: {customer.address}<br />
              Email: {customer.email}<br />
              Profissão: {customer.profession}<br />
              Estado Civil: {customer.maritalStatus}<br />
              Natural de: {customer.birthplace}
            </p>
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div className={contractStyles.section}>
        <h2 className={contractStyles.sectionTitle}>Do Imóvel</h2>
        
        <p className={contractStyles.paragraph}>
          O imóvel objeto deste contrato trata-se do <strong>Lote {lot.identifier}</strong>, 
          localizado no <strong>Bloco {lot.block.identifier}</strong>, com as seguintes características:
        </p>

        <table className={contractStyles.table}>
          <tbody>
            <tr>
              <td className={contractStyles.tableHeader}>Identificação</td>
              <td className={contractStyles.tableCell}>Bloco {lot.block.identifier} - Lote {lot.identifier}</td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Área Total</td>
              <td className={contractStyles.tableCell}>{lot.totalArea.toFixed(2)} m²</td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Dimensões</td>
              <td className={contractStyles.tableCell}>
                Frente: {lot.front.toFixed(2)}m | Fundo: {lot.back.toFixed(2)}m<br />
                Lateral Esquerda: {lot.leftSide.toFixed(2)}m | Lateral Direita: {lot.rightSide.toFixed(2)}m
              </td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Valor do Imóvel</td>
              <td className={contractStyles.tableCell}><strong>{formatCurrency(lot.price)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financial Terms */}
      <div className={contractStyles.section}>
        <h2 className={contractStyles.sectionTitle}>Das Condições de Pagamento</h2>
        
        <p className={contractStyles.paragraph}>
          O valor total do imóvel é de <strong>{formatCurrency(sale.totalValue)}</strong>, 
          que será pago da seguinte forma:
        </p>

        <table className={contractStyles.table}>
          <tbody>
            <tr>
              <td className={contractStyles.tableHeader}>Valor Total</td>
              <td className={contractStyles.tableCell}><strong>{formatCurrency(sale.totalValue)}</strong></td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Entrada</td>
              <td className={contractStyles.tableCell}>
                {formatCurrency(sale.downPayment)} 
                {sale.downPayment > 0 && (
                  <span className="text-sm text-gray-600 ml-2">
                    (a ser pago na assinatura do contrato)
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Saldo Financiado</td>
              <td className={contractStyles.tableCell}>
                {formatCurrency(sale.totalValue - sale.downPayment)}
              </td>
            </tr>
            <tr>
              <td className={contractStyles.tableHeader}>Parcelas</td>
              <td className={contractStyles.tableCell}>
                <strong>{sale.installmentCount} parcelas</strong> de {formatCurrency(sale.installmentValue)} cada
                {sale.annualAdjustment && (
                  <br />
                  <span className="text-sm text-gray-600">
                    * Valores sujeitos a reajuste anual pelo INCC (Índice Nacional de Custo da Construção)
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Terms and Conditions */}
      <div className={contractStyles.section}>
        <h2 className={contractStyles.sectionTitle}>Das Cláusulas Gerais</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 1ª - DO OBJETO</h3>
            <p className={contractStyles.paragraph}>
              O presente contrato tem por objeto a compra e venda do lote de terreno descrito 
              na cláusula "Do Imóvel", livre e desembaraçado de qualquer ônus, dívida ou gravame.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 2ª - DO PREÇO E FORMA DE PAGAMENTO</h3>
            <p className={contractStyles.paragraph}>
              O preço ajustado para a compra e venda é o especificado na seção de condições 
              de pagamento. As parcelas vencem no dia {new Date().getDate()} de cada mês, 
              iniciando-se um mês após a assinatura deste contrato.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 3ª - DA ENTREGA E POSSE</h3>
            <p className={contractStyles.paragraph}>
              A posse definitiva do imóvel será transferida ao COMPRADOR mediante a quitação 
              integral do preço acordado e a assinatura da escritura pública de compra e venda.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 4ª - DAS OBRIGAÇÕES DO VENDEDOR</h3>
            <p className={contractStyles.paragraph}>
              O VENDEDOR se obriga a entregar o imóvel livre de qualquer ônus, dívida ou 
              impedimento legal, bem como fornecer toda a documentação necessária para 
              a transferência da propriedade.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 5ª - DAS OBRIGAÇÕES DO COMPRADOR</h3>
            <p className={contractStyles.paragraph}>
              O COMPRADOR se obriga ao pagamento pontual das parcelas acordadas, sob pena 
              de incidência de multa de 2% sobre o valor em atraso, mais juros de 1% ao mês 
              e correção monetária.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 6ª - DO INADIMPLEMENTO</h3>
            <p className={contractStyles.paragraph}>
              O atraso superior a 90 (noventa) dias no pagamento de qualquer parcela 
              constituirá o COMPRADOR em mora, podendo o VENDEDOR, a seu critério, 
              considerar rescindido o presente contrato.
            </p>
          </div>

          <div>
            <h3 className="font-bold mb-2">CLÁUSULA 7ª - DO FORO</h3>
            <p className={contractStyles.paragraph}>
              As partes elegem o foro da Comarca de [Cidade/Estado] para dirimir 
              quaisquer dúvidas ou questões oriundas do presente contrato.
            </p>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className={contractStyles.signatureSection}>
        <h2 className={contractStyles.sectionTitle}>Das Assinaturas</h2>
        
        <p className={contractStyles.paragraph}>
          E por estarem assim justos e contratados, firmam o presente instrumento em 
          duas vias de igual teor e forma, na presença de duas testemunhas abaixo assinadas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="text-center">
            <div className={contractStyles.signatureLine}></div>
            <p className="font-bold">LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</p>
            <p className="text-sm text-gray-600">VENDEDOR</p>
          </div>

          <div className="text-center">
            <div className={contractStyles.signatureLine}></div>
            <p className="font-bold">{customer.name.toUpperCase()}</p>
            <p className="text-sm text-gray-600">COMPRADOR</p>
            <p className="text-sm text-gray-600">CPF: {formatCPF(customer.cpf)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="text-center">
            <div className={contractStyles.signatureLine}></div>
            <p className="font-bold">TESTEMUNHA 1</p>
            <p className="text-sm text-gray-600">Nome: _________________________</p>
            <p className="text-sm text-gray-600">CPF: _________________________</p>
          </div>

          <div className="text-center">
            <div className={contractStyles.signatureLine}></div>
            <p className="font-bold">TESTEMUNHA 2</p>
            <p className="text-sm text-gray-600">Nome: _________________________</p>
            <p className="text-sm text-gray-600">CPF: _________________________</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={contractStyles.footer}>
        <p>Contrato de Compra e Venda de Imóvel - {contractNumber}</p>
        <p>Gerado automaticamente pelo sistema Lotiva em {formatDate(generatedAt)}</p>
      </div>
    </div>
  )
}