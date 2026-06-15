const fs = require('fs')
const path = require('path')
const PizZip = require('pizzip')

const sourcePath = process.argv[2]
const outputPath = process.argv[3]

if (!sourcePath || !outputPath) {
  console.error('Uso: node scripts/prepare-terramar-docx.js <origem.docx> <destino.docx>')
  process.exit(1)
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function paragraphText(paragraph) {
  return decodeXml(
    [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join(''),
  ).replace(/\u00a0/g, ' ')
}

function getRunProperties(paragraph) {
  return paragraph.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
}

function withBold(runProperties) {
  if (!runProperties) {
    return '<w:rPr><w:b/><w:bCs/></w:rPr>'
  }

  let result = runProperties
  if (!/<w:b(?:\s[^>]*)?\/?>/.test(result)) {
    result = result.replace('</w:rPr>', '<w:b/><w:bCs/></w:rPr>')
  }
  return result
}

function makeRun(text, runProperties, bold = false) {
  const properties = bold ? withBold(runProperties) : runProperties
  return `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function replaceParagraph(xml, matcher, segments) {
  let replacements = 0
  const nextXml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphText(paragraph).trim()
    if (!matcher(text)) {
      return paragraph
    }

    replacements += 1
    const opening = paragraph.match(/^<w:p(?:\s[^>]*)?>/)?.[0] ?? '<w:p>'
    const paragraphProperties = paragraph.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/)?.[0] ?? ''
    const runProperties = getRunProperties(paragraph)
    const runs = segments
      .map((segment) => makeRun(segment.text, runProperties, segment.bold))
      .join('')

    return `${opening}${paragraphProperties}${runs}</w:p>`
  })

  if (replacements === 0) {
    throw new Error(`Paragrafo nao encontrado: ${matcher.description ?? matcher}`)
  }

  return nextXml
}

function startsWith(prefix) {
  const matcher = (text) => text.startsWith(prefix)
  matcher.description = prefix
  return matcher
}

function equals(expected) {
  const matcher = (text) => text === expected
  matcher.description = expected
  return matcher
}

const zip = new PizZip(fs.readFileSync(sourcePath))
let xml = zip.file('word/document.xml')?.asText()

if (!xml) {
  throw new Error('O DOCX nao possui word/document.xml.')
}

const replacements = [
  [
    startsWith('Nos termos do Instrumento de Promessa'),
    [
      { text: 'Nos termos do Instrumento de Promessa de Compra e Venda virem, que aos ' },
      { text: '{{contrato.data}}' },
      { text: ', nesta Cidade de Camaçari, Estado da Bahia, faz saber às partes entre si justas e contratadas: de um lado:' },
    ],
  ],
  [
    startsWith('PROMITENTE VENDEDOR:'),
    [
      { text: 'PROMITENTE VENDEDOR: {{vendedor.nome}}, CNPJ: {{vendedor.documento}}, situada em {{vendedor.endereco}}.', bold: true },
    ],
  ],
  [
    startsWith('PROMITENTE COMPRADOR:'),
    [
      {
        text: 'PROMITENTE COMPRADOR: {{cliente.nome}}, {{cliente.estado_civil}}, {{cliente.profissao}}, portador(a) da Cédula de Identidade nº {{cliente.rg}}, CPF nº {{cliente.cpf}}, residente e domiciliado(a) em {{cliente.endereco}}. Endereço eletrônico: {{cliente.email}}.',
        bold: true,
      },
    ],
  ],
  [
    startsWith('Por este Instrumento e na melhor forma de direito'),
    [
      { text: 'Por este Instrumento e na melhor forma de direito, o PROMITENTE VENDEDOR promete vender ao PROMITENTE COMPRADOR, que promete comprar, o lote Nº ' },
      { text: '{{lote.numero}}' },
      { text: ' da quadra ' },
      { text: '{{lote.quadra}}' },
      { text: ', totalizando ' },
      { text: '{{lote.area}}' },
      { text: ', acima descrito e caracterizado, de acordo com os termos, cláusulas, condições e demais estipulações deste contrato, que reciprocamente se comprometem, por si e sucessores, a cumprir e respeitar de forma integral.' },
    ],
  ],
  [startsWith('FRENTE:'), [{ text: 'FRENTE: {{lote.frente}};' }]],
  [startsWith('FUNDO:'), [{ text: 'FUNDO: {{lote.fundo}};' }]],
  [startsWith('LADO DIREITO:'), [{ text: 'LADO DIREITO: {{lote.lateral_direita}};' }]],
  [startsWith('LADO ESQUERDO:'), [{ text: 'LADO ESQUERDO: {{lote.lateral_esquerda}}.' }]],
  [
    startsWith('A presente transação é feita pelo preço certo'),
    [
      { text: 'A presente transação é feita pelo preço certo e ajustado da promessa de compra e venda, ora pactuada entre as partes contratantes no valor total de ' },
      { text: '{{venda.valor_total}}' },
      { text: ' (' },
      { text: '{{venda.valor_total_extenso}}' },
      { text: '), a ser pago na seguinte forma:' },
    ],
  ],
  [
    startsWith('I – Pagamento da entrada'),
    [
      { text: 'I – Pagamento da entrada, no valor de ' },
      { text: '{{venda.entrada}}' },
      { text: ' (' },
      { text: '{{venda.entrada_extenso}}' },
      { text: '), que se refere a um sinal de ' },
      { text: '{{venda.entrada_percentual}}' },
      { text: ' do preço total, valor pago no ato da assinatura deste contrato. O pagamento será realizado por meio de transferência bancária ou PIX em favor de Terranova Incorporação e Construção Ltda, CNPJ: 59.506.986/0001-19, para o Banco nº 461 – Asaas I.P. S.A., Ag. nº 0001, Conta nº 5647225-1 ou chave PIX: 59.506.986/0001-19, ou ainda em boleto bancário destinado ao Promitente Vendedor;' },
    ],
  ],
  [
    startsWith('II – O valor remanescente'),
    [
      { text: 'II – O valor remanescente de ' },
      { text: '{{venda.saldo}}' },
      { text: ' (' },
      { text: '{{venda.saldo_extenso}}' },
      { text: ') a ser pago em ' },
      { text: '{{venda.numero_parcelas}}' },
      { text: ' (' },
      { text: '{{venda.numero_parcelas_extenso}}' },
      { text: ') parcelas consecutivas de ' },
      { text: '{{venda.valor_parcela}}' },
      { text: ' (' },
      { text: '{{venda.valor_parcela_extenso}}' },
      { text: '), por meio de boleto bancário destinado ao Promitente Vendedor, iniciando a partir de ' },
      { text: '{{venda.primeiro_vencimento}}' },
      { text: ' e, nos meses subsequentes, sucessivamente, corrigido anualmente pelo índice do INCC (Índice Nacional de Custo da Construção), enquanto perdurar a realização da obra do loteamento, e pelo IPCA após a finalização da obra até o final do contrato. A respectiva quitação se dará após o pagamento da última parcela;' },
    ],
  ],
  [
    startsWith('O PROMITENTE COMPRADOR declara ser conhecedor da planta'),
    [
      { text: 'O PROMITENTE COMPRADOR declara ser conhecedor da planta do ' },
      { text: '{{empreendimento.nome}}' },
      { text: ', bem como do estágio em que se encontra a implantação do mesmo, aceitando-o formalmente e declarando estar de acordo com todas as cláusulas contratuais aqui pactuadas.' },
    ],
  ],
  [
    startsWith('As obras do LOTEAMENTO RECANTO TERRAMAR'),
    [
      { text: 'As obras do ' },
      { text: '{{empreendimento.nome}}' },
      { text: ' tais como: Obras de terraplanagem; Rede de Abastecimento de água potável – EMBASA; Pavimentação das ruas; Rede Elétrica com postes, transformadores, iluminação externa nas ruas e no clube; Rede de drenagem das ruas; Instalação de guias de meio fio; Demarcação dos lotes, individualmente e clube com os seguintes itens: Quiosque – Espaço Gourmet, Praça, Parquinho, Campo de Futebol Society, Quadra de Futevôlei / Beach tênis, estão todas a cargo do PROMITENTE VENDEDOR, ' },
      { text: '{{vendedor.nome}}' },
      { text: ', e possuem previsão de se findar em 36 meses, com um prazo de tolerância de 180 dias, a partir da assinatura deste contrato, ressalvados também os casos fortuitos e de força maior, podendo ser antecipada para qualquer prazo.' },
    ],
  ],
  [
    startsWith('O PROMITENTE COMPRADOR concorda que o PROMITENTE VENDEDOR'),
    [
      { text: 'O PROMITENTE COMPRADOR concorda que o PROMITENTE VENDEDOR, por si ou por ele contratados, mantenha, sem ônus de qualquer espécie, no local que escolher dentro do empreendimento, incluído o clube com a sua área de lazer, até a venda total dos lotes, escritório de vendas ou de outras atividades publicitárias, inclusive permitindo a realização de eventos e visitação pública, com livre acesso ao ' },
      { text: '{{empreendimento.nome}}' },
      { text: ' ou ao seu clube.' },
    ],
  ],
  [
    startsWith('Declara o PROMITENTE COMPRADOR que visitou previamente'),
    [
      { text: 'Declara o PROMITENTE COMPRADOR que visitou previamente o local onde será implantado o ' },
      { text: '{{empreendimento.nome}}' },
      { text: ' para identificação e escolha da localização do seu lote e quadra, sendo conhecedor, portanto, da situação do lote e suas características topográficas.' },
    ],
  ],
  [
    startsWith('Camaçari, Bahia –'),
    [{ text: '                           Camaçari, Bahia – {{contrato.data}}' }],
  ],
  [
    equals('Terranova Incorporação e Construção Ltda'),
    [{ text: '{{vendedor.nome}}' }],
  ],
  [
    equals('CNPJ: 59.506.986/0001-19'),
    [{ text: 'CNPJ: {{vendedor.documento}}' }],
  ],
  [
    equals('Joabison de Souza Oliveira'),
    [{ text: '{{cliente.nome}}' }],
  ],
  [
    equals('CPF: 042.774.465-23'),
    [{ text: 'CPF: {{cliente.cpf}}' }],
  ],
]

for (const [matcher, segments] of replacements) {
  xml = replaceParagraph(xml, matcher, segments)
}

zip.file('word/document.xml', xml)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))

console.log(`Modelo gerado em ${outputPath}`)
