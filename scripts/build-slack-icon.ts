// Bouwt een vierkante Slack-app-icon van het Workx-logo.
// Slack vereist square 512-2000px.
// Output: C:\Users\quiri\Downloads\workx-slack-icon.png (1024x1024)

import sharp from 'sharp'
import { existsSync } from 'fs'

const SRC_CANDIDATES = [
  'C:\\Users\\quiri\\Downloads\\Workx logo.jpg',
  'C:\\Users\\quiri\\Downloads\\Logo_Workx-email2.jpg',
  'public/workx-logo.png',
]
const OUT = 'C:\\Users\\quiri\\Downloads\\workx-slack-icon.png'
const SIZE = 1024
const LOGO_SCALE = 0.86 // 86% van canvas — laat wat witruimte rondom

async function main() {
  const src = SRC_CANDIDATES.find(p => existsSync(p))
  if (!src) {
    console.error('Geen bron-logo gevonden')
    process.exit(1)
  }
  console.log('Bron:', src)
  const meta = await sharp(src).metadata()
  console.log(`Origineel: ${meta.width}x${meta.height}`)

  const targetInner = Math.round(SIZE * LOGO_SCALE)
  // Schalen zodat het past binnen targetInner x targetInner (behoud aspect)
  const resized = await sharp(src)
    .resize({ width: targetInner, height: targetInner, fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  // Plaats op een witte vierkante canvas
  await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(OUT)

  const out = await sharp(OUT).metadata()
  console.log(`Output: ${OUT}`)
  console.log(`Afmetingen: ${out.width}x${out.height}`)
}

main().catch(err => { console.error(err); process.exit(1) })
