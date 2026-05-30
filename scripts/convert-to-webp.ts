// Converteert grote PNG's naar WebP voor snellere page-loads.
// workx-logo.png blijft PNG (jsPDF heeft die nodig).

import sharp from 'sharp'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'

const PUBLIC = resolve('public')
const TARGETS = [
  { src: 'workx-pand.png', quality: 85 },
  { src: 'fiets.png', quality: 85 },
  { src: 'bird.webp', quality: 0 }, // skip — al webp
]

async function main() {
  for (const t of TARGETS) {
    if (t.quality === 0) continue
    const inPath = resolve(PUBLIC, t.src)
    if (!existsSync(inPath)) { console.warn('skip:', t.src, 'bestaat niet'); continue }
    const outPath = inPath.replace(/\.png$/i, '.webp')
    const before = statSync(inPath).size
    await sharp(inPath).webp({ quality: t.quality }).toFile(outPath)
    const after = statSync(outPath).size
    const pct = Math.round((1 - after / before) * 100)
    console.log(`${t.src} → ${t.src.replace('.png', '.webp')}: ${before}B → ${after}B (-${pct}%)`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
