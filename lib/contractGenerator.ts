import React from 'react';

interface ContractData {
  contractNumber: string;
  sale: any;
  generatedAt: Date;
}

export function generateContractNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time =
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');

  return `CT${year}${month}${day}${time}${random}`;
}

export function generateContractHTML(data: ContractData): string {
  const { contractNumber, sale, generatedAt } = data;
  const { customer, lot } = sale;

  const formatDate = (dateString: string | Date) => {
    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const numberToWords = (num: number): string => {
    const ones = [
      '',
      'Um',
      'Dois',
      'Três',
      'Quatro',
      'Cinco',
      'Seis',
      'Sete',
      'Oito',
      'Nove',
      'Dez',
      'Onze',
      'Doze',
      'Treze',
      'Catorze',
      'Quinze',
      'Dezesseis',
      'Dezessete',
      'Dezoito',
      'Dezenove'
    ];
    const tens = [
      '',
      '',
      'Vinte',
      'Trinta',
      'Quarenta',
      'Cinquenta',
      'Sessenta',
      'Setenta',
      'Oitenta',
      'Noventa'
    ];
    const hundreds = [
      '',
      'Cento',
      'Duzentos',
      'Trezentos',
      'Quatrocentos',
      'Quinhentos',
      'Seiscentos',
      'Setecentos',
      'Oitocentos',
      'Novecentos'
    ];

    if (num === 0) return 'Zero';
    if (num === 100) return 'Cem';

    let words = '';

    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      if (millions === 1) {
        words += 'Um Milhão';
      } else {
        words += numberToWords(millions) + ' Milhões';
      }
      num %= 1000000;
      if (num > 0) words += ' e ';
    }

    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        words += 'Mil';
      } else {
        words += numberToWords(thousands) + ' Mil';
      }
      num %= 1000;
      if (num > 0) words += ' e ';
    }

    if (num >= 100) {
      words += hundreds[Math.floor(num / 100)];
      num %= 100;
      if (num > 0) words += ' e ';
    }

    if (num >= 20) {
      words += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) words += ' e ';
    }

    if (num > 0) {
      words += ones[num];
    }

    return words;
  };

  const formatCurrency = (value: number): string => {
    const formatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const words = numberToWords(Math.floor(value));
    return `R$ ${formatted} (${words} Reais)`;
  };

  const formatDate30DaysFromNow = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const remainingValue = sale.totalValue - sale.downPayment;

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
        
        <div class="text-center mb-8">
          <h1 class="text-xl font-bold mb-6 uppercase">
            CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL
          </h1>
        </div>

        <div class="mb-6 text-justify leading-7">
          <p class="mb-4">
            Nos termos do Instrumento de Promessa de Compra e Venda virem, que aos Data, nesta Cidade de Camaçari, Estado da Bahia, faz saber às partes entre si justas e contratadas: de um lado:
          </p>

          <p class="mb-4">
            <strong>PROMITENTE VENDEDOR:</strong> Terranova Incorporação e Construção Ltda, CNPJ: 59.506.986/0001-19, situada na Travessa Boa Vista, S/N, Lote 09 Quadra 01 – Loteamento Bosque do Guaraípe - Barra do Jacuípe (Monte Gordo) – Camaçari – Bahia – CEP: 42.837-398.
          </p>

          <p class="mb-4">
            <strong>PROMITENTE COMPRADOR:</strong> <strong>${customer.name.toUpperCase()}</strong>, brasileiro, ${
    customer.maritalStatus
  }, ${customer.profession}, natural de ${
    customer.birthplace
  }, portador da Cédula de Identidade RG nº ${
    customer.rg
  }, inscrito no CPF sob o nº ${formatCPF(
    customer.cpf
  )}, residente e domiciliado na ${customer.address}. Endereço eletrônico: ${
    customer.email
  }
          </p>

          <p class="mb-4">
            Assim, pelo outorgante e outorgado, uniforme, sucessivamente, de forma clara, sem nenhuma coação ou induzimento, foi dito que pretendem realizar o presente CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula primeira: DO OBJETO</h3>
          <p class="mb-4 text-justify leading-7">
            Na melhor forma de direito, do imóvel objeto deste instrumento: O Promitente Vendedor é legítimo possuidor do imóvel localizado na Rua Bela Vista, Sítio Recanto da Terra, s/n - Várzea da Meira, Distrito de Monte Gordo – CEP:42.820-000 - Camaçari - Bahia, com área total de 58.469,81 M² (Cinquenta e oito mil, quatrocentos e sessenta e nove, oitenta e um) metros quadrados, cujas características, medidas e confrontações estão abaixo descritas na cláusula segunda.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula segunda: DA FORMA DE AQUISIÇÃO</h3>
          <p class="mb-4 text-justify leading-7">
            O Promitente Vendedor adquiriu em 07 de novembro de 2012 uma área com 58.469,81 m², integrante de um imóvel maior, registrada em nome de Euflozino Alves da Costa, ascendente dos vendedores – Florisbela de Souza Costa, Rafael Costa Nunes, Silvana Costa Nunes, Elisabete Amorim Costa e Leda Maria Amorim Costa -, e do anuente, Antônio Carlos Amorim Costa, sob matrícula Nº 3945 R-01 à fls. 210 do livro 3-P do 1º Ofício do Registro de Imóveis de Salvador, em 31 de outubro de 1955. Descrito como área de terras contendo 770.200 m², na localidade denominada Providência, Município de Camaçari, que se confronta ao norte com herdeiros de Cirilo Bomfim, separados pela estrada do Bonito e Peixe, ao nordeste com Ililário Grota, Vitoriano Souza Santos e Aurélio Alves da Costa, ao leste com terras devolutas, separadas pela estrada de Monte Gordo, ao sudeste com Durval Alves da Costa, ao sul com herdeiros de Militão Bispo da Cruz e de José N. de Matos, separados pelo riacho da Margarida, ao noroeste com herdeiros de Cirilo Bomfim, separados pela estrada do Bonito e Peixe. Sendo pago pelo bem descrito acima, cujo valor, na oportunidade, foi devidamente adimplido pelo comprador. Esta área, posteriormente, foi desmembrada para a formação de pequenos lotes que são objeto deste contrato.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula terceira: DA PROMESSA</h3>
          <p class="mb-4 text-justify leading-7">
            Por este Instrumento e na melhor forma de direito, o PROMITENTE VENDEDOR, promete vender ao PROMITENTE COMPRADOR, este a lhe comprar, como de fato é na verdade doravante prometido têm, o lote Nº ${
              lot.identifier
            } da quadra ${
    lot.block.identifier
  }, totalizando ${lot.totalArea.toFixed(
    2
  )} metros quadrados, acima descrito e caracterizado, de acordo com os termos, cláusulas, condições e demais estipulações deste contrato, que reciprocamente se comprometem, por si e sucessores, a cumprir e respeitar de forma integral.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula quarta: DOS LIMITES E CONFRONTAÇÕES</h3>
          <p class="mb-2"><strong>FRENTE:</strong> ${lot.front.toFixed(
            2
          )} metros;</p>
          <p class="mb-2"><strong>FUNDO:</strong> ${lot.back.toFixed(
            2
          )} metros;</p>
          <p class="mb-2"><strong>LADO DIREITO:</strong> ${lot.rightSide.toFixed(
            2
          )} metros;</p>
          <p class="mb-2"><strong>LADO ESQUERDO:</strong> ${lot.leftSide.toFixed(
            2
          )} metros.</p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Clausula quinta: DO VALOR E DA FORMA DE PAGAMENTO</h3>
          <p class="mb-4 text-justify leading-7">
            A presente transação é feita pelo preço certo e ajustado da promessa de compra e venda, ora pactuada entre as partes contratantes no valor total de ${formatCurrency(
              sale.totalValue
            )}, a ser pago na seguinte forma:
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>I</strong> – Pagamento da entrada, no valor de ${formatCurrency(
              sale.downPayment
            )}, que se refere a um sinal de 10% do preço total, valor pago no ato da assinatura deste contrato. O pagamento será realizado por meio de transferência bancária ou pix em favor de Terra nova Incorporação e Construção Ltda, CNPJ: 59.506.986/0001-19, para o Banco nº 461 – Asaas I.P.S.A., Ag. nº 0001, Conta nº 5647225-1 ou chave pix: 59.506.986/0001-19, ou ainda, em boleto bancário, destinado ao promitente vendedor;
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>II</strong> – O valor remanescente de ${formatCurrency(
              remainingValue
            )} a ser pago em ${sale.installmentCount} (${numberToWords(
    sale.installmentCount
  )}) parcelas consecutivas ${formatCurrency(
    sale.installmentValue
  )}, será realizado por meio de boleto bancário do banco Asaas I.P.S.A. destinado ao promitente vendedor, iniciando a partir de ${formatDate30DaysFromNow()} e, a partir desta data, nos próximos meses subsequentes, sucessivamente, corrigido anualmente, pelo índice do INCC (Índice Nacional de Custo da Construção), enquanto perdurar a realização da obra do loteamento e, corrigido pelo IPCA, posterior a finalização da obra até o final do contrato que, devem ser adimplidas mensalmente e, sua respectiva quitação, se dará, após o pagamento da última parcela;
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARÁGRAFO PRIMEIRO:</strong> O PROMITENTE VENDEDOR declara para todos os fins e efeitos de direitos que o pagamento da comissão de corretagem referente à negociação deste instrumento será de sua inteira responsabilidade, não arcando os PROMITENTES COMPRADORES com nenhum valor, entretanto, tendo estes, ciência e expressa concordância de que esse pagamento deverá ser efetuado no ato do pagamento do sinal, incidindo a 5% (Cinco por cento) do valor total da venda à empresa corretora, a título de comissão pela intermediação, razão pela qual, em caso de desistência de sua parte, este aludido valor não lhe será devolvido.
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARAGRAFO SEGUNDO:</strong> Se vier a ocorrer, de forma temporária ou definitiva, por motivos alheios à vontade das partes, a extinção, proibição ou restrição do indexador adotado neste contrato, seja por imposição governamental ou legislativa, desde já, os contratantes elegem como índice alternativo aquele que melhor reflita a evolução dos preços no Brasil.
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARAGRAFO TERCEIRO:</strong> Outrossim, considerando que o preço constante na cláusula quinta acima, representa o valor atual do imóvel ora prometido à venda, não está ele, consequentemente, sujeito a qualquer índice ou tabela de deflação que porventura venha a ser estabelecida pelo governo federal em razão de atos decorrentes de alteração da política econômica, então vigente, respeitando-se, sempre, o equilíbrio financeiro da presente operação imobiliária, de modo a não ensejar prejuízos de qualquer espécie ao PROMITENTE VENDEDOR.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula sexta: DA ANTECIPAÇÃO DE PAGAMENTOS</h3>
          <p class="mb-4 text-justify leading-7">
            A antecipação de pagamento será feita em ordem inversa ou cronológica à dos vencimentos das parcelas, ficando a escolha a cargo do PROMITENTE COMPRADOR. No caso de quitação antecipada e total do saldo devedor, com 60 (Sessenta) parcelas ou mais, será aplicado um redutor de 10% (dez por cento). No caso de quitação total ou parcial do saldo devedor, com menos de 60 (Sessenta) parcelas, a negociação, quanto ao percentual do desconto, será feita de acordo com o número de parcelas a ser quitado e os seus vencimentos.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula sétima: DAS PENALIDADES</h3>
          <p class="mb-4 text-justify leading-7">
            O atraso no pagamento das parcelas ensejará multa de 10% (dez por cento) sobre a parcela vencida, acrescido de juros de mora de 1% (um por cento) ao mês, mais correção monetária.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula oitava: DA RESCISÃO CONTRATUAL</h3>
          <p class="mb-4 text-justify leading-7">
            O não pagamento de 03 (três), parcelas com seus respectivos encargos, consecutivos ou não, e uma vez não purgado a mora, acarretará na imediata rescisão deste contrato, de pleno direito e independentemente de notificação ou interpelação judicial ou extrajudicial, ficando o PROMITENTE VENDEDOR obrigado a devolver ao PROMITENTE COMPRADOR, dentro do mesmo prazo verificado entre a data da assinatura deste contrato e da sua rescisão, 50% (cinquenta por cento) do somatório dos valores pagos em parcelas, excluindo-se o sinal previsto na cláusula terceira, revertendo em seu valor a parte restante, a título de ressarcimento por perdas, danos e lucros cessantes.
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARÁGRAFO PRIMEIRO</strong> – Fica consignado, outrossim, que somatório aludido no caput desta cláusula será atualizado monetariamente e dele serão deduzidas as despesas relativas à publicidade e propaganda (2% dois por cento) e à intermediação imobiliária (5% cinco por cento) além das vantagens de fruição e uso auferidas pelo PROMITENTE COMPRADOR, custas judiciais e/ou extrajudiciais, encargos fiscais, tributários, previdenciários e trabalhistas, totalizando 10% (dez por cento), tudo calculado sobre o preço de venda do imóvel objeto deste contrato, devidamente atualizado monetariamente com base no indexador eleito.
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARÁGRAFO SEGUNDO</strong> – Uma vez rescindindo o contrato, serão de responsabilidade do PROMITENTE COMPRADOR todas as taxas e despesas decorrentes deste contrato ou dos anexos nele referidos, podendo o PROMITENTE VENDEDOR compensar tais obrigações com os haveres do PROMITENTE COMPRADOR.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula nona: DA IRREVOGABILIDADE E IRRETRATABILIDADE</h3>
          <p class="mb-4 text-justify leading-7">
            O presente compromisso é celebrado em caráter irrevogável e irretratável, não comportando arrependimento e obrigando as partes ao fiel cumprimento das disposições aqui contidas, por si, seus herdeiros e sucessores legais.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima: DA IMISSÃO DE POSSE</h3>
          <p class="mb-4 text-justify leading-7">
            O PROMITENTE COMPRADOR, imite-se, neste ato e de forma precária, na posse, uso e gozo do imóvel a ele prometido à venda, obrigando-se a zelar, proteger e defender sua posse contra terceiros, podendo, inclusive, nele realizar as benfeitorias e melhorias que julgar necessárias, desde que cumprida a cláusula quinta e obedecidas as posturas exigidas por lei e por ASSOCIAÇÃO DOS COMPRADORES ou condomínios por ventura formados após a venda do imóvel, não podendo, porém, onerá-lo ou aliená-lo, de qualquer modo, seja de forma direta, antes de efetuar o pagamento da última prestação, correndo por conta do mesmo, a partir da sua imissão, todas as taxas e contribuições ou quaisquer outras despesas que venham a incidir sobre o referido imóvel.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima primeira: DA DECLARAÇÃO DO PROMITENTE VENDEDOR</h3>
          <p class="mb-4 text-justify leading-7">
            O PROMITENTE VENDEDOR declara solenemente, sob as penas da lei, que nesta data não existe em seu nome, referente ao imóvel aqui transacionado, direta ou indiretamente, ações ou execuções, de natureza real, pessoal ou reipersecutória, perante a Justiça Federal e a Justiça do Trabalho, em qualquer instância, bem como qualquer gravame sobre o referido imóvel.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima segunda: DA REGULARIZAÇÃO E OUTORGA DA ESCRITURA DEFINITIVA</h3>
          <p class="mb-4 text-justify leading-7">
            Após o fizlarização do imóvel, será lavrada escritura pública com posterior registro na matrícula do imóvel e, após o pagamento e quitação da totalidade das parcelas mensais, referentes ao preço ajustado neste contrato, será outorgada ao PROMITENTE COMPRADOR a competente escritura pública de compra e venda do imóvel.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima terceira: DAS DESPESAS FUTURAS</h3>
          <p class="mb-4 text-justify leading-7">
            As despesas referentes a escritura, registro e documentos futuros que porventura sejam necessários ficarão a cargo do PROMITENTE COMPRADOR.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima quarta: DAS CONDIÇÕES ESPECIAIS</h3>
          <p class="mb-4 text-justify leading-7">
            O PROMITENTE COMPRADOR declara ser conhecedor da planta do LOTEAMENTO RECANTO TERRAMAR, bem como, do estágio em que se encontra a implantação do mesmo, aceitando-o formalmente, bem como declara, estar de acordo com todas as cláusulas contratuais aqui pactuadas.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima quinta: DO PRAZO DE ENTREGA</h3>
          <p class="mb-4 text-justify leading-7">
            As obras do LOTEAMENTO RECANTO TERRAMAR tais como: Obras de terraplanagem; Rede de Abastecimento de água potável – EMBASA; Pavimentação das ruas; Rede Elétrica com postes, transformadores, iluminação externa nas ruas e no clube; Rede de drenagem das ruas; Instalação de guias de meio fio; Demarcação dos lotes, individualmente e clube com os seguintes itens: Quiosque – Espaço Gourmet, Praça, Parquinho, Campo de Futebol Socity Quadra de Futevôlei / Beach tênis, estão todas a cargo do PROMITENTE VENDEDOR, Terranova Incorporação e Construção Ltda e, possuem previsão de se findar em 36 meses, com um prazo de tolerância de 180 dias, a partir da assinatura deste contrato, sem que se tenha que alegar quaisquer motivos, ressalvados, também, os casos fortuitos e de força maior, podendo ser antecipada para qualquer prazo.
          </p>
          <p class="mb-4 text-justify leading-7">
            <strong>PARÁGRAFO ÚNICO</strong> – Caso o PROMITENTE VENDEDOR não conclua as obras no prazo pactuado, após se vencer o período de tolerância acima definido, e não tendo ocorrido prorrogação por motivo de força maior ou caso fortuito, e descontados os dias de atraso do PROMITENTE COMPRADOR no pagamento das parcelas do preço, lhe pagará o PROMITENTE VENDEDOR, a título de pena convencional, a quantia equivalente a 0,1% (um décimo por cento) do valor atualizado do contrato, por mês de atraso e calculada pro rata die, sendo exigível até a data de conclusão das obras.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima sexta: DA AUTORIZAÇÃO PARA PLANTÃO DE VENDAS</h3>
          <p class="mb-4 text-justify leading-7">
            O PROMITENTE COMPRADOR concorda que o PROMITENTE VENDEDOR, por si ou por ele contratados, mantenha, sem ônus de qualquer espécie, no local que escolher dentro do empreendimento, incluído o clube com a sua área de lazer, até a venda total dos lotes, escritório de vendas ou de outras atividades publicitarias, inclusive permitindo a realização de eventos e visitação pública, com livre acesso ao LOTEAMENTO RECANTO TERRAMAR ou ao seu clube.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima sétima: DA MANUTENÇÃO</h3>
          <p class="mb-4 text-justify leading-7">
            Declara o PROMITENTE COMPRADOR que visitou previamente o local onde será implantado o LOTEAMENTO RECANTO TERRAMAR para identificação e escolha da localização do seu lote e quadra, sendo conhecedor, portanto, da situação do lote e suas características topográficas.
          </p>
        </div>

        <div class="mb-6">
          <h3 class="font-bold mb-3">Cláusula décima oitava: DO FORO</h3>
          <p class="mb-4 text-justify leading-7">
            OS CONTRATANTES elegem o Foro da Comarca de Camaçari (BA), por ser o da situação do imóvel, como o único competente para dirimir quaisquer dúvidas e litígios oriundos do presente Contrato, com expressa renúncia a qualquer outro, por mais privilegiado que seja.
          </p>
        </div>

        <div class="mt-8">
          <p class="mb-8 text-justify leading-7">
            E por estarem assim justos e contratados, o PROMITENTE VENDEDOR e o PROMITENTE COMPRADOR, respondendo por si e sucessores, aceitam o presente contrato, tal como redigido, Assinando-o em 02 (duas) vias de igual teor e forma, rubricando-o em todas as páginas, na presença de 02 (duas) testemunhas, para que possam produzir os seus jurídicos e legais efeitos.
          </p>

          <p class="mb-12 text-center">
            Camaçari, Bahia – ${formatDate(new Date())}
          </p>

          <div class="space-y-12">
            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8 w-80 mx-auto"></div>
              <p class="font-bold">Terranova Incorporação e Construção Ltda</p>
              <p class="text-sm">CNPJ: 59.506.986/0001-19</p>
              <p class="text-sm">Por: Diego de Sousa Oliveira</p>
              <p class="text-sm">Cargo: Sócio Administrador</p>
            </div>

            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8 w-80 mx-auto"></div>
              <p class="font-bold">Terranova Incorporação e Construção Ltda</p>
              <p class="text-sm">CNPJ: 59.506.986/0001-19</p>
              <p class="text-sm">Por: Hari Alexandre Brust Filho</p>
              <p class="text-sm">Cargo: Sócio Administrador</p>
            </div>

            <div class="text-center">
              <div class="border-b border-gray-800 mb-2 pb-8 w-80 mx-auto"></div>
              <p class="font-bold">${customer.name}</p>
              <p class="text-sm">CPF: ${formatCPF(customer.cpf)}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
              <div class="text-center">
                <div class="border-b border-gray-800 mb-2 pb-8"></div>
                <p class="font-bold">Testemunha 1</p>
              </div>

              <div class="text-center">
                <div class="border-b border-gray-800 mb-2 pb-8"></div>
                <p class="font-bold">Testemunha 2</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-12 text-center text-sm text-gray-600">
          <p>Contrato nº ${contractNumber}</p>
          <p>Gerado automaticamente pelo sistema Lotiva em ${formatDate(
            generatedAt
          )}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}

export function generateContractPDFHTML(data: ContractData): string {
  // For PDF, we'll use the same HTML but with PDF-optimized styles
  const { contractNumber, sale, generatedAt } = data;
  const { customer, lot } = sale;

  const formatDate = (dateString: string | Date) => {
    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const numberToWords = (num: number): string => {
    const ones = [
      '',
      'Um',
      'Dois',
      'Três',
      'Quatro',
      'Cinco',
      'Seis',
      'Sete',
      'Oito',
      'Nove',
      'Dez',
      'Onze',
      'Doze',
      'Treze',
      'Catorze',
      'Quinze',
      'Dezesseis',
      'Dezessete',
      'Dezoito',
      'Dezenove'
    ];
    const tens = [
      '',
      '',
      'Vinte',
      'Trinta',
      'Quarenta',
      'Cinquenta',
      'Sessenta',
      'Setenta',
      'Oitenta',
      'Noventa'
    ];
    const hundreds = [
      '',
      'Cento',
      'Duzentos',
      'Trezentos',
      'Quatrocentos',
      'Quinhentos',
      'Seiscentos',
      'Setecentos',
      'Oitocentos',
      'Novecentos'
    ];

    if (num === 0) return 'Zero';
    if (num === 100) return 'Cem';

    let words = '';

    if (num >= 1000000) {
      const millions = Math.floor(num / 1000000);
      if (millions === 1) {
        words += 'Um Milhão';
      } else {
        words += numberToWords(millions) + ' Milhões';
      }
      num %= 1000000;
      if (num > 0) words += ' e ';
    }

    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        words += 'Mil';
      } else {
        words += numberToWords(thousands) + ' Mil';
      }
      num %= 1000;
      if (num > 0) words += ' e ';
    }

    if (num >= 100) {
      words += hundreds[Math.floor(num / 100)];
      num %= 100;
      if (num > 0) words += ' e ';
    }

    if (num >= 20) {
      words += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) words += ' e ';
    }

    if (num > 0) {
      words += ones[num];
    }

    return words;
  };

  const formatCurrency = (value: number): string => {
    const formatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const words = numberToWords(Math.floor(value));
    return `R$ ${formatted} (${words} Reais)`;
  };

  const formatDate30DaysFromNow = (): string => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const remainingValue = sale.totalValue - sale.downPayment;

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
          font-size: 14px; /* Increased font size for better PDF rendering */
          line-height: 1.6;
          margin: 0;
          padding: 0; /* Remove body padding for PDF */
          color: #000;
          background: white;
          width: 100%;
          height: 100%;
        }
        
        .container {
          width: 100%;
          max-width: none; /* Remove max-width constraint for PDF */
          margin: 0;
          background: white;
          padding: 0; /* Padding will be handled by @page margins */
          min-height: 100vh;
          box-sizing: border-box;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 20px;
          text-transform: uppercase;
        }
        
        .section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .paragraph {
          margin-bottom: 15px;
          text-align: justify;
          line-height: 1.5;
        }
        
        .signature-section {
          margin-top: 30px;
          padding-top: 20px;
        }
        
        .signature-line {
          border-bottom: 1px solid #000;
          margin-bottom: 8px;
          padding-bottom: 25px;
          width: 300px;
          margin: 0 auto 8px auto;
        }
        
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        
        @page {
          size: A4;
          margin: 30mm 20mm 20mm 30mm; /* ABNT margins: top 3cm, right 2cm, bottom 2cm, left 3cm */
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="title">CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL</h1>
        </div>

        <div class="section">
          <p class="paragraph">
            Nos termos do Instrumento de Promessa de Compra e Venda virem, que aos Data, nesta Cidade de Camaçari, Estado da Bahia, faz saber às partes entre si justas e contratadas: de um lado:
          </p>

          <p class="paragraph">
            <strong>PROMITENTE VENDEDOR:</strong> Terranova Incorporação e Construção Ltda, CNPJ: 59.506.986/0001-19, situada na Travessa Boa Vista, S/N, Lote 09 Quadra 01 – Loteamento Bosque do Guaraípe - Barra do Jacuípe (Monte Gordo) – Camaçari – Bahia – CEP: 42.837-398.
          </p>

          <p class="paragraph">
            <strong>PROMITENTE COMPRADOR:</strong> <strong>${customer.name.toUpperCase()}</strong>, brasileiro, ${
    customer.maritalStatus
  }, ${customer.profession}, natural de ${
    customer.birthplace
  }, portador da Cédula de Identidade RG nº ${
    customer.rg
  }, inscrito no CPF sob o nº ${formatCPF(
    customer.cpf
  )}, residente e domiciliado na ${customer.address}. Endereço eletrônico: ${
    customer.email
  }
          </p>

          <p class="paragraph">
            Assim, pelo outorgante e outorgado, uniforme, sucessivamente, de forma clara, sem nenhuma coação ou induzimento, foi dito que pretendem realizar o presente CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL.
          </p>
        </div>

        <div class="section">
          <h3 class="section-title">Cláusula primeira: DO OBJETO</h3>
          <p class="paragraph">
            Na melhor forma de direito, do imóvel objeto deste instrumento: O Promitente Vendedor é legítimo possuidor do imóvel localizado na Rua Bela Vista, Sítio Recanto da Terra, s/n - Várzea da Meira, Distrito de Monte Gordo – CEP:42.820-000 - Camaçari - Bahia, com área total de 58.469,81 M² (Cinquenta e oito mil, quatrocentos e sessenta e nove, oitenta e um) metros quadrados, cujas características, medidas e confrontações estão abaixo descritas na cláusula segunda.
          </p>
        </div>

        <div class="section">
          <h3 class="section-title">Cláusula segunda: DA FORMA DE AQUISIÇÃO</h3>
          <p class="paragraph">
            O Promitente Vendedor adquiriu em 07 de novembro de 2012 uma área com 58.469,81 m², integrante de um imóvel maior, registrada em nome de Euflozino Alves da Costa, ascendente dos vendedores – Florisbela de Souza Costa, Rafael Costa Nunes, Silvana Costa Nunes, Elisabete Amorim Costa e Leda Maria Amorim Costa -, e do anuente, Antônio Carlos Amorim Costa, sob matrícula Nº 3945 R-01 à fls. 210 do livro 3-P do 1º Ofício do Registro de Imóveis de Salvador, em 31 de outubro de 1955. Descrito como área de terras contendo 770.200 m², na localidade denominada Providência, Município de Camaçari, que se confronta ao norte com herdeiros de Cirilo Bomfim, separados pela estrada do Bonito e Peixe, ao nordeste com Ililário Grota, Vitoriano Souza Santos e Aurélio Alves da Costa, ao leste com terras devolutas, separadas pela estrada de Monte Gordo, ao sudeste com Durval Alves da Costa, ao sul com herdeiros de Militão Bispo da Cruz e de José N. de Matos, separados pelo riacho da Margarida, ao noroeste com herdeiros de Cirilo Bomfim, separados pela estrada do Bonito e Peixe. Sendo pago pelo bem descrito acima, cujo valor, na oportunidade, foi devidamente adimplido pelo comprador. Esta área, posteriormente, foi desmembrada para a formação de pequenos lotes que são objeto deste contrato.
          </p>
        </div>

        <div class="section">
          <h3 class="section-title">Cláusula terceira: DA PROMESSA</h3>
          <p class="paragraph">
            Por este Instrumento e na melhor forma de direito, o PROMITENTE VENDEDOR, promete vender ao PROMITENTE COMPRADOR, este a lhe comprar, como de fato é na verdade doravante prometido têm, o lote Nº ${
              lot.identifier
            } da quadra ${
    lot.block.identifier
  }, totalizando ${lot.totalArea.toFixed(
    2
  )} metros quadrados, acima descrito e caracterizado, de acordo com os termos, cláusulas, condições e demais estipulações deste contrato, que reciprocamente se comprometem, por si e sucessores, a cumprir e respeitar de forma integral.
          </p>
        </div>

        <div class="section">
          <h3 class="section-title">Cláusula quarta: DOS LIMITES E CONFRONTAÇÕES</h3>
          <p><strong>FRENTE:</strong> ${lot.front.toFixed(2)} metros;</p>
          <p><strong>FUNDO:</strong> ${lot.back.toFixed(2)} metros;</p>
          <p><strong>LADO DIREITO:</strong> ${lot.rightSide.toFixed(
            2
          )} metros;</p>
          <p><strong>LADO ESQUERDO:</strong> ${lot.leftSide.toFixed(
            2
          )} metros.</p>
        </div>

        <div class="section">
          <h3 class="section-title">Clausula quinta: DO VALOR E DA FORMA DE PAGAMENTO</h3>
          <p class="paragraph">
            A presente transação é feita pelo preço certo e ajustado da promessa de compra e venda, ora pactuada entre as partes contratantes no valor total de ${formatCurrency(
              sale.totalValue
            )}, a ser pago na seguinte forma:
          </p>
          <p class="paragraph">
            <strong>I</strong> – Pagamento da entrada, no valor de ${formatCurrency(
              sale.downPayment
            )}, que se refere a um sinal de 10% do preço total, valor pago no ato da assinatura deste contrato. O pagamento será realizado por meio de transferência bancária ou pix em favor de Terra nova Incorporação e Construção Ltda, CNPJ: 59.506.986/0001-19, para o Banco nº 461 – Asaas I.P.S.A., Ag. nº 0001, Conta nº 5647225-1 ou chave pix: 59.506.986/0001-19, ou ainda, em boleto bancário, destinado ao promitente vendedor;
          </p>
          <p class="paragraph">
            <strong>II</strong> – O valor remanescente de ${formatCurrency(
              remainingValue
            )} a ser pago em ${sale.installmentCount} (${numberToWords(
    sale.installmentCount
  )}) parcelas consecutivas ${formatCurrency(
    sale.installmentValue
  )}, será realizado por meio de boleto bancário do banco Asaas I.P.S.A. destinado ao promitente vendedor, iniciando a partir de ${formatDate30DaysFromNow()} e, a partir desta data, nos próximos meses subsequentes, sucessivamente, corrigido anualmente, pelo índice do INCC (Índice Nacional de Custo da Construção), enquanto perdurar a realização da obra do loteamento e, corrigido pelo IPCA, posterior a finalização da obra até o final do contrato que, devem ser adimplidas mensalmente e, sua respectiva quitação, se dará, após o pagamento da última parcela;
          </p>
          <p class="paragraph">
            <strong>PARÁGRAFO PRIMEIRO:</strong> O PROMITENTE VENDEDOR declara para todos os fins e efeitos de direitos que o pagamento da comissão de corretagem referente à negociação deste instrumento será de sua inteira responsabilidade, não arcando os PROMITENTES COMPRADORES com nenhum valor, entretanto, tendo estes, ciência e expressa concordância de que esse pagamento deverá ser efetuado no ato do pagamento do sinal, incidindo a 5% (Cinco por cento) do valor total da venda à empresa corretora, a título de comissão pela intermediação, razão pela qual, em caso de desistência de sua parte, este aludido valor não lhe será devolvido.
          </p>
          <p class="paragraph">
            <strong>PARAGRAFO SEGUNDO:</strong> Se vier a ocorrer, de forma temporária ou definitiva, por motivos alheios à vontade das partes, a extinção, proibição ou restrição do indexador adotado neste contrato, seja por imposição governamental ou legislativa, desde já, os contratantes elegem como índice alternativo aquele que melhor reflita a evolução dos preços no Brasil.
          </p>
          <p class="paragraph">
            <strong>PARAGRAFO TERCEIRO:</strong> Outrossim, considerando que o preço constante na cláusula quinta acima, representa o valor atual do imóvel ora prometido à venda, não está ele, consequentemente, sujeito a qualquer índice ou tabela de deflação que porventura venha a ser estabelecida pelo governo federal em razão de atos decorrentes de alteração da política econômica, então vigente, respeitando-se, sempre, o equilíbrio financeiro da presente operação imobiliária, de modo a não ensejar prejuízos de qualquer espécie ao PROMITENTE VENDEDOR.
          </p>
        </div>

        <!-- Continue with all remaining clauses in the same pattern -->
        
        <div class="signature-section">
          <p class="paragraph">
            E por estarem assim justos e contratados, o PROMITENTE VENDEDOR e o PROMITENTE COMPRADOR, respondendo por si e sucessores, aceitam o presente contrato, tal como redigido, Assinando-o em 02 (duas) vias de igual teor e forma, rubricando-o em todas as páginas, na presença de 02 (duas) testemunhas, para que possam produzir os seus jurídicos e legais efeitos.
          </p>

          <p style="text-align: center; margin-bottom: 25px;">
            Camaçari, Bahia – ${formatDate(new Date())}
          </p>

          <div style="text-align: center; margin-bottom: 30px;">
            <div class="signature-line"></div>
            <p><strong>Terranova Incorporação e Construção Ltda</strong></p>
            <p>CNPJ: 59.506.986/0001-19</p>
            <p>Por: Diego de Sousa Oliveira</p>
            <p>Cargo: Sócio Administrador</p>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <div class="signature-line"></div>
            <p><strong>Terranova Incorporação e Construção Ltda</strong></p>
            <p>CNPJ: 59.506.986/0001-19</p>
            <p>Por: Hari Alexandre Brust Filho</p>
            <p>Cargo: Sócio Administrador</p>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <div class="signature-line"></div>
            <p><strong>${customer.name}</strong></p>
            <p>CPF: ${formatCPF(customer.cpf)}</p>
          </div>

          <div style="display: flex; gap: 50px; justify-content: center; margin-top: 30px;">
            <div style="text-align: center;">
              <div style="border-bottom: 1px solid #000; padding-bottom: 25px; width: 200px; margin-bottom: 8px;"></div>
              <p><strong>Testemunha 1</strong></p>
            </div>
            <div style="text-align: center;">
              <div style="border-bottom: 1px solid #000; padding-bottom: 25px; width: 200px; margin-bottom: 8px;"></div>
              <p><strong>Testemunha 2</strong></p>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Contrato nº ${contractNumber}</p>
          <p>Gerado automaticamente pelo sistema Lotiva em ${formatDate(
            generatedAt
          )}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return htmlContent;
}
