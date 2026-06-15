import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { pathToFileURL } from 'url'
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { documentVariableGroups, getDocumentValues, isOptionalDocumentVariable, validateDocumentVariables } from './document-templates'

const execFileAsync = promisify(execFile)

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export function inspectDocx(buffer: Buffer, customKeys: string[] = []) {
  let zip: PizZip
  try {
    zip = new PizZip(buffer)
  } catch {
    throw new Error('O arquivo enviado nao e um DOCX valido.')
  }

  const xml = Object.keys(zip.files)
    .filter((fileName) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(fileName))
    .map((fileName) => zip.file(fileName)?.asText() ?? '')
    .join('')
  const text = decodeXml(xml.replace(/<[^>]+>/g, ''))
  const variables = [...new Set(
    [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1].trim()),
  )]
  const validation = validateDocumentVariables(variables, customKeys)

  return {
    variables,
    unknownVariables: validation.unknownVariables,
    hash: createHash('sha256').update(buffer).digest('hex'),
  }
}

export function renderDocxTemplate(input: {
  template: Buffer
  sale: Parameters<typeof getDocumentValues>[0]
  contractNumber: string
  generatedAt: Date
}) {
  const values = getDocumentValues(input.sale, input.contractNumber, input.generatedAt)
  const inspection = inspectDocx(
    input.template,
    [
      ...(input.sale.lot.block.development?.company?.documentVariables ?? []).map((item) => item.key),
      ...(input.sale.lot.block.development?.documentValues ?? []).map((item) => item.variable.key),
    ],
  )
  if (inspection.unknownVariables.length > 0) {
    throw new Error(`Variaveis desconhecidas: ${inspection.unknownVariables.join(', ')}`)
  }

  const missingVariables = inspection.variables.filter(
    (variable) => !isOptionalDocumentVariable(variable, input.sale) && !String(values[variable] ?? '').trim(),
  )
  if (missingVariables.length > 0) {
    return { buffer: null, missingVariables }
  }

  const doc = new Docxtemplater(new PizZip(input.template), {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    parser: (tag) => ({
      get: () => values[tag.trim()] ?? '',
    }),
  })

  doc.render()
  return {
    buffer: doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer,
    missingVariables: [],
  }
}

async function findLibreOffice() {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    'libreoffice',
    'soffice',
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'], { timeout: 10000 })
      return candidate
    } catch {
      // Try the next known executable.
    }
  }
  throw new Error('LibreOffice nao esta instalado no ambiente de execucao.')
}

export async function convertDocxToPdf(docx: Buffer) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'lotiva-docx-'))
  try {
    const inputPath = path.join(directory, 'document.docx')
    const outputPath = path.join(directory, 'document.pdf')
    const profilePath = path.join(directory, 'libreoffice-profile')
    await writeFile(inputPath, docx)

    const executable = await findLibreOffice()
    await execFileAsync(executable, [
      `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
      '--headless',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to',
      'pdf',
      '--outdir',
      directory,
      inputPath,
    ], { timeout: 120000 })

    return await readFile(outputPath)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function createSampleDocx() {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'MODELO DE CONTRATO LOTIVA', bold: true, size: 26, font: 'Calibri' })],
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Use as variaveis exatamente como exibidas, incluindo as chaves duplas.', size: 22, font: 'Calibri' })],
    }),
  ]

  for (const group of documentVariableGroups) {
    paragraphs.push(new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: group.label.toUpperCase(), bold: true, size: 24, font: 'Calibri' })],
    }))
    for (const [variable, label] of group.variables) {
      paragraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `{{${variable}}}`, size: 22, font: 'Calibri' }),
        ],
      }))
    }
  }

  return Packer.toBuffer(new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{ children: paragraphs }],
  }))
}
