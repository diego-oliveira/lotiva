import { renderDocxTemplate } from './docxDocuments'
import { readDocumentFile, saveDocumentFile } from './documentStorage'

export async function generateContractDocuments(input: {
  templatePath: string
  sale: Parameters<typeof renderDocxTemplate>[0]['sale']
  contractNumber: string
  generatedAt: Date
}) {
  const template = await readDocumentFile(input.templatePath)
  const rendered = renderDocxTemplate({
    template,
    sale: input.sale,
    contractNumber: input.contractNumber,
    generatedAt: input.generatedAt,
  })
  if (!rendered.buffer) {
    return {
      docxPath: null,
      pdfPath: null,
      missingVariables: rendered.missingVariables,
    }
  }

  const docxPath = await saveDocumentFile(rendered.buffer, 'contracts', 'docx')

  return {
    docxPath,
    pdfPath: null,
    missingVariables: [],
  }
}
