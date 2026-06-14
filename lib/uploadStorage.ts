import path from 'path'

export const uploadPublicPath = (process.env.UPLOAD_PUBLIC_PATH || '/uploads').replace(/\/$/, '')

export const uploadDirectory = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'public', 'uploads')

export const maxUploadSize = 5 * 1024 * 1024

export const allowedImageTypes: Record<string, { extension: string; contentType: string }> = {
  'image/jpeg': { extension: 'jpg', contentType: 'image/jpeg' },
  'image/png': { extension: 'png', contentType: 'image/png' },
  'image/webp': { extension: 'webp', contentType: 'image/webp' },
}

export const imageContentTypesByExtension: Record<string, string> = Object.fromEntries(
  Object.values(allowedImageTypes).map(({ extension, contentType }) => [extension, contentType]),
)

export function buildUploadUrl(fileName: string) {
  return `${uploadPublicPath}/${fileName}`
}

export function isSafeUploadFileName(fileName: string) {
  return /^[a-f0-9-]+\.(jpg|png|webp)$/i.test(fileName)
}

export function getUploadFilePath(fileName: string) {
  return path.join(uploadDirectory, fileName)
}

export function isValidUploadedImagePath(value: string) {
  if (!value.startsWith(`${uploadPublicPath}/`)) return false
  return isSafeUploadFileName(value.slice(uploadPublicPath.length + 1))
}
