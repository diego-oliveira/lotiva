import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}

function createIcon(size, maskable = false) {
  const rows = []
  const radius = maskable ? 0 : Math.round(size * 0.22)
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x += 1) {
      const cornerX = x < radius ? radius - x : x >= size - radius ? x - (size - radius - 1) : 0
      const cornerY = y < radius ? radius - y : y >= size - radius ? y - (size - radius - 1) : 0
      const inside = !radius || !cornerX || !cornerY || cornerX * cornerX + cornerY * cornerY <= radius * radius
      const left = maskable ? 0.328 : 0.3
      const top = maskable ? 0.25 : 0.219
      const verticalRight = maskable ? 0.465 : 0.449
      const verticalBottom = maskable ? 0.633 : 0.648
      const horizontalRight = maskable ? 0.707 : 0.723
      const horizontalBottom = maskable ? 0.754 : 0.781
      const letter = (x >= size * left && x <= size * verticalRight && y >= size * top && y <= size * horizontalBottom) ||
        (x >= size * left && x <= size * horizontalRight && y >= size * verticalBottom && y <= size * horizontalBottom)
      const offset = 1 + x * 4
      row.set(letter ? [255, 255, 255, 255] : inside ? [60, 80, 224, 255] : [0, 0, 0, 0], offset)
    }
    rows.push(row)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/lotiva-192.png', createIcon(192))
writeFileSync('public/icons/lotiva-512.png', createIcon(512))
writeFileSync('public/icons/apple-touch-icon.png', createIcon(180))
writeFileSync('public/icons/lotiva-maskable-512.png', createIcon(512, true))
