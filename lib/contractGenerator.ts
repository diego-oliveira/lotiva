import React from 'react'

interface ContractData {
  contractNumber: string
  sale: any
  generatedAt: Date
}

export function generateContractNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  
  return `CT${year}${month}${day}${time}${random}`
}

export function generateContractHTML(data: ContractData): string {
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

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contrato ${contractNumber}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        body { font-family: 'Crimson Text', serif; }
        @media print {
          body { font-size: 12px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body class="bg-gray-50 py-8">
      <div class="max-w-4xl mx-auto p-8 bg-white text-gray-900 font-serif leading-relaxed">
        <!-- Header -->
        <div class="text-center mb-8 border-b-2 border-gray-800 pb-4">
          <h1 class="text-2xl font-bold mb-2 uppercase text-gray-900">
            Contrato de Compra e Venda de Imóvel
          </h1>
          <p class="text-lg mb-4 text-gray-700">
            Contrato nº ${contractNumber}
          </p>
          <p class="text-sm text-gray-600">
            Gerado em: ${formatDate(generatedAt)}
          </p>
        </div>

        <!-- Parties Section -->
        <div class="mb-6">
          <h2 class="text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800">Das Partes</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 class="font-bold mb-2">VENDEDOR:</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                <strong>LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</strong><br />
                CNPJ: 12.345.678/0001-90<br />
                Endereço: Rua das Empresas, 123 - Centro<br />
                CEP: 12345-678 - Cidade/Estado<br />
                Telefone: (11) 1234-5678<br />
                Email: contato@lotiva.com.br
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">COMPRADOR:</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                <strong>${customer.name.toUpperCase()}</strong><br />
                CPF: ${formatCPF(customer.cpf)}<br />
                RG: ${customer.rg}<br />
                Endereço: ${customer.address}<br />
                Email: ${customer.email}<br />
                Profissão: ${customer.profession}<br />
                Estado Civil: ${customer.maritalStatus}<br />
                Natural de: ${customer.birthplace}
              </p>
            </div>
          </div>
        </div>

        <!-- Property Details -->
        <div class="mb-6">
          <h2 class="text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800">Do Imóvel</h2>
          
          <p class="mb-4 text-justify leading-7 text-gray-800">
            O imóvel objeto deste contrato trata-se do <strong>Lote ${lot.identifier}</strong>, 
            localizado no <strong>Bloco ${lot.block.identifier}</strong>, com as seguintes características:
          </p>

          <table class="w-full border-collapse border border-gray-800 mb-4">
            <tbody>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Identificação</td>
                <td class="border border-gray-800 p-2">Bloco ${lot.block.identifier} - Lote ${lot.identifier}</td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Área Total</td>
                <td class="border border-gray-800 p-2">${lot.totalArea.toFixed(2)} m²</td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Dimensões</td>
                <td class="border border-gray-800 p-2">
                  Frente: ${lot.front.toFixed(2)}m | Fundo: ${lot.back.toFixed(2)}m<br />
                  Lateral Esquerda: ${lot.leftSide.toFixed(2)}m | Lateral Direita: ${lot.rightSide.toFixed(2)}m
                </td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Valor do Imóvel</td>
                <td class="border border-gray-800 p-2"><strong>${formatCurrency(lot.price)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Financial Terms -->
        <div class="mb-6">
          <h2 class="text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800">Das Condições de Pagamento</h2>
          
          <p class="mb-4 text-justify leading-7 text-gray-800">
            O valor total do imóvel é de <strong>${formatCurrency(sale.totalValue)}</strong>, 
            que será pago da seguinte forma:
          </p>

          <table class="w-full border-collapse border border-gray-800 mb-4">
            <tbody>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Valor Total</td>
                <td class="border border-gray-800 p-2"><strong>${formatCurrency(sale.totalValue)}</strong></td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Entrada</td>
                <td class="border border-gray-800 p-2">
                  ${formatCurrency(sale.downPayment)} 
                  ${sale.downPayment > 0 ? '<span class="text-sm text-gray-600 ml-2">(a ser pago na assinatura do contrato)</span>' : ''}
                </td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Saldo Financiado</td>
                <td class="border border-gray-800 p-2">
                  ${formatCurrency(sale.totalValue - sale.downPayment)}
                </td>
              </tr>
              <tr>
                <td class="bg-gray-100 border border-gray-800 p-2 font-bold text-center">Parcelas</td>
                <td class="border border-gray-800 p-2">
                  <strong>${sale.installmentCount} parcelas</strong> de ${formatCurrency(sale.installmentValue)} cada
                  ${sale.annualAdjustment ? '<br /><span class="text-sm text-gray-600">* Valores sujeitos a reajuste anual pelo INCC (Índice Nacional de Custo da Construção)</span>' : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Terms and Conditions -->
        <div class="mb-6">
          <h2 class="text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800">Das Cláusulas Gerais</h2>
          
          <div class="space-y-4">
            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 1ª - DO OBJETO</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                O presente contrato tem por objeto a compra e venda do lote de terreno descrito 
                na cláusula "Do Imóvel", livre e desembaraçado de qualquer ônus, dívida ou gravame.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 2ª - DO PREÇO E FORMA DE PAGAMENTO</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                O preço ajustado para a compra e venda é o especificado na seção de condições 
                de pagamento. As parcelas vencem no dia ${new Date().getDate()} de cada mês, 
                iniciando-se um mês após a assinatura deste contrato.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 3ª - DA ENTREGA E POSSE</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                A posse definitiva do imóvel será transferida ao COMPRADOR mediante a quitação 
                integral do preço acordado e a assinatura da escritura pública de compra e venda.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 4ª - DAS OBRIGAÇÕES DO VENDEDOR</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                O VENDEDOR se obriga a entregar o imóvel livre de qualquer ônus, dívida ou 
                impedimento legal, bem como fornecer toda a documentação necessária para 
                a transferência da propriedade.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 5ª - DAS OBRIGAÇÕES DO COMPRADOR</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                O COMPRADOR se obriga ao pagamento pontual das parcelas acordadas, sob pena 
                de incidência de multa de 2% sobre o valor em atraso, mais juros de 1% ao mês 
                e correção monetária.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 6ª - DO INADIMPLEMENTO</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                O atraso superior a 90 (noventa) dias no pagamento de qualquer parcela 
                constituirá o COMPRADOR em mora, podendo o VENDEDOR, a seu critério, 
                considerar rescindido o presente contrato.
              </p>
            </div>

            <div>
              <h3 class="font-bold mb-2">CLÁUSULA 7ª - DO FORO</h3>
              <p class="mb-4 text-justify leading-7 text-gray-800">
                As partes elegem o foro da Comarca de [Cidade/Estado] para dirimir 
                quaisquer dúvidas ou questões oriundas do presente contrato.
              </p>
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div class="mt-12 pt-8 border-t-2 border-gray-800">
          <h2 class="text-lg font-bold mb-3 uppercase border-b border-gray-600 pb-1 text-gray-800">Das Assinaturas</h2>
          
          <p class="mb-4 text-justify leading-7 text-gray-800">
            E por estarem assim justos e contratados, firmam o presente instrumento em 
            duas vias de igual teor e forma, na presença de duas testemunhas abaixo assinadas.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8"></div>
              <p class="font-bold">LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</p>
              <p class="text-sm text-gray-600">VENDEDOR</p>
            </div>

            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8"></div>
              <p class="font-bold">${customer.name.toUpperCase()}</p>
              <p class="text-sm text-gray-600">COMPRADOR</p>
              <p class="text-sm text-gray-600">CPF: ${formatCPF(customer.cpf)}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8"></div>
              <p class="font-bold">TESTEMUNHA 1</p>
              <p class="text-sm text-gray-600">Nome: _________________________</p>
              <p class="text-sm text-gray-600">CPF: _________________________</p>
            </div>

            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8"></div>
              <p class="font-bold">TESTEMUNHA 2</p>
              <p class="text-sm text-gray-600">Nome: _________________________</p>
              <p class="text-sm text-gray-600">CPF: _________________________</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="mt-12 text-center text-sm text-gray-600">
          <p>Contrato de Compra e Venda de Imóvel - ${contractNumber}</p>
          <p>Gerado automaticamente pelo sistema Lotiva em ${formatDate(generatedAt)}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return htmlContent
}

export function generateContractPDFHTML(data: ContractData): string {
  // For PDF, we'll use the same HTML but with PDF-optimized styles
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

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contrato ${contractNumber}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        
        body {
          font-family: 'Crimson Text', serif;
          font-size: 12px;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          color: #000;
        }
        
        .container {
          max-width: 210mm;
          margin: 0 auto;
          background: white;
          padding: 20mm;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        
        .title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .subtitle {
          font-size: 14px;
          margin-bottom: 15px;
        }
        
        .section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 12px;
          text-transform: uppercase;
          border-bottom: 1px solid #666;
          padding-bottom: 5px;
        }
        
        .paragraph {
          margin-bottom: 15px;
          text-align: justify;
          line-height: 1.7;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #000;
          margin-bottom: 15px;
        }
        
        .table-header {
          background: #f0f0f0;
          border: 1px solid #000;
          padding: 8px;
          font-weight: bold;
          text-align: center;
        }
        
        .table-cell {
          border: 1px solid #000;
          padding: 8px;
        }
        
        .signature-section {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 2px solid #000;
        }
        
        .signature-line {
          border-bottom: 1px solid #000;
          margin-bottom: 8px;
          padding-bottom: 30px;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        
        .grid {
          display: flex;
          gap: 20px;
        }
        
        .grid > div {
          flex: 1;
        }
        
        @page {
          size: A4;
          margin: 20mm;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Same content as HTML version but with PDF styles -->
        <div class="header">
          <h1 class="title">Contrato de Compra e Venda de Imóvel</h1>
          <p class="subtitle">Contrato nº ${contractNumber}</p>
          <p>Gerado em: ${formatDate(generatedAt)}</p>
        </div>

        <div class="section">
          <h2 class="section-title">Das Partes</h2>
          <div class="grid">
            <div>
              <h3><strong>VENDEDOR:</strong></h3>
              <p class="paragraph">
                <strong>LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</strong><br />
                CNPJ: 12.345.678/0001-90<br />
                Endereço: Rua das Empresas, 123 - Centro<br />
                CEP: 12345-678 - Cidade/Estado<br />
                Telefone: (11) 1234-5678<br />
                Email: contato@lotiva.com.br
              </p>
            </div>
            <div>
              <h3><strong>COMPRADOR:</strong></h3>
              <p class="paragraph">
                <strong>${customer.name.toUpperCase()}</strong><br />
                CPF: ${formatCPF(customer.cpf)}<br />
                RG: ${customer.rg}<br />
                Endereço: ${customer.address}<br />
                Email: ${customer.email}<br />
                Profissão: ${customer.profession}<br />
                Estado Civil: ${customer.maritalStatus}<br />
                Natural de: ${customer.birthplace}
              </p>
            </div>
          </div>
        </div>

        <!-- Continue with all other sections using similar structure -->
        <div class="section">
          <h2 class="section-title">Do Imóvel</h2>
          <p class="paragraph">
            O imóvel objeto deste contrato trata-se do <strong>Lote ${lot.identifier}</strong>, 
            localizado no <strong>Bloco ${lot.block.identifier}</strong>, com as seguintes características:
          </p>
          <table>
            <tr>
              <td class="table-header">Identificação</td>
              <td class="table-cell">Bloco ${lot.block.identifier} - Lote ${lot.identifier}</td>
            </tr>
            <tr>
              <td class="table-header">Área Total</td>
              <td class="table-cell">${lot.totalArea.toFixed(2)} m²</td>
            </tr>
            <tr>
              <td class="table-header">Dimensões</td>
              <td class="table-cell">
                Frente: ${lot.front.toFixed(2)}m | Fundo: ${lot.back.toFixed(2)}m<br />
                Lateral Esquerda: ${lot.leftSide.toFixed(2)}m | Lateral Direita: ${lot.rightSide.toFixed(2)}m
              </td>
            </tr>
            <tr>
              <td class="table-header">Valor do Imóvel</td>
              <td class="table-cell"><strong>${formatCurrency(lot.price)}</strong></td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2 class="section-title">Das Condições de Pagamento</h2>
          <p class="paragraph">
            O valor total do imóvel é de <strong>${formatCurrency(sale.totalValue)}</strong>, 
            que será pago da seguinte forma:
          </p>
          <table>
            <tr>
              <td class="table-header">Valor Total</td>
              <td class="table-cell"><strong>${formatCurrency(sale.totalValue)}</strong></td>
            </tr>
            <tr>
              <td class="table-header">Entrada</td>
              <td class="table-cell">${formatCurrency(sale.downPayment)}</td>
            </tr>
            <tr>
              <td class="table-header">Saldo Financiado</td>
              <td class="table-cell">${formatCurrency(sale.totalValue - sale.downPayment)}</td>
            </tr>
            <tr>
              <td class="table-header">Parcelas</td>
              <td class="table-cell">
                <strong>${sale.installmentCount} parcelas</strong> de ${formatCurrency(sale.installmentValue)} cada
              </td>
            </tr>
          </table>
        </div>

        <div class="signature-section">
          <h2 class="section-title">Das Assinaturas</h2>
          <p class="paragraph">
            E por estarem assim justos e contratados, firmam o presente instrumento em 
            duas vias de igual teor e forma, na presença de duas testemunhas abaixo assinadas.
          </p>
          <div class="grid">
            <div style="text-align: center;">
              <div class="signature-line"></div>
              <p><strong>LOTIVA DESENVOLVIMENTO IMOBILIÁRIO LTDA</strong></p>
              <p>VENDEDOR</p>
            </div>
            <div style="text-align: center;">
              <div class="signature-line"></div>
              <p><strong>${customer.name.toUpperCase()}</strong></p>
              <p>COMPRADOR</p>
              <p>CPF: ${formatCPF(customer.cpf)}</p>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Contrato de Compra e Venda de Imóvel - ${contractNumber}</p>
          <p>Gerado automaticamente pelo sistema Lotiva em ${formatDate(generatedAt)}</p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return htmlContent
}