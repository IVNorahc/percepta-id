// Renders public/favicon.svg into a multi-resolution favicon.ico (16/32/48 px,
// PNG-embedded — supported by all modern browsers).
// Run with: node scripts/generate-favicon.mjs
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')
const svg = readFileSync(join(publicDir, 'favicon.svg'))

const sizes = [16, 32, 48]

const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' }).png().toBuffer(),
  ),
)

// Also emit a 32px preview so the result can be eyeballed.
writeFileSync(join(here, 'favicon-preview.png'), pngs[1])

// ── Assemble ICO ──────────────────────────────────────────────────────────
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(sizes.length, 4) // image count

const entries = []
let offset = 6 + sizes.length * 16
sizes.forEach((size, i) => {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
  entry.writeUInt8(0, 2) // palette count
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8) // image byte size
  entry.writeUInt32LE(offset, 12) // image offset
  offset += pngs[i].length
  entries.push(entry)
})

const ico = Buffer.concat([header, ...entries, ...pngs])
writeFileSync(join(publicDir, 'favicon.ico'), ico)
console.log(`✓ favicon.ico (${sizes.join('/')} px, ${ico.length} bytes)`)
