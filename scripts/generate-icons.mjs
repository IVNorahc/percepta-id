// Rasterizes the Percepta brand SVGs into the PWA PNG icons.
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const publicDir = join(here, '..', 'public')

const darkSvg = readFileSync(join(here, 'icon-dark.svg'))
const whiteSvg = readFileSync(join(here, 'icon-white.svg'))

const targets = [
  { svg: darkSvg, size: 192, out: 'icon-192x192.png' },
  { svg: darkSvg, size: 512, out: 'icon-512x512.png' },
  { svg: whiteSvg, size: 180, out: 'apple-touch-icon.png' },
]

for (const { svg, size, out } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toFile(join(publicDir, out))
  console.log(`✓ ${out} (${size}x${size})`)
}
