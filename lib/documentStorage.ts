import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'

export const documentStorageDirectory = process.env.DOCUMENT_STORAGE_DIR
  ? path.resolve(process.env.DOCUMENT_STORAGE_DIR)
  : path.join(process.cwd(), 'storage', 'documents')

function safeExtension(extension: string) {
  return extension.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export async function saveDocumentFile(buffer: Buffer, folder: string, extension: string) {
  const directory = path.join(documentStorageDirectory, folder)
  await mkdir(directory, { recursive: true })
  const fileName = `${randomUUID()}.${safeExtension(extension)}`
  const filePath = path.join(directory, fileName)
  await writeFile(filePath, buffer)
  return filePath
}

export function readDocumentFile(filePath: string) {
  return readFile(filePath)
}

