#!/usr/bin/env node
/**
 * Downloads the Design Studio's curated fonts (src/shared/design-core/fonts.json)
 * as static TrueType files from the Google Fonts CSS API and writes them to
 * both places that read them:
 *   - src/backend/assets/design-fonts/   (server renders: PNG, PDF, previews)
 *   - src/frontend/public/design-fonts/  (the editor, same bytes)
 * The same files on both sides is what makes the editor and the issued
 * certificate identical - text is shaped with HarfBuzz and drawn as paths.
 *
 * Idempotent: existing files are skipped. Run: node scripts/design/fetch-fonts.mjs
 * All fonts are SIL Open Font License (OFL) from fonts.google.com.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/shared/design-core/fonts.json'), 'utf8'))
const outDirs = ['src/backend/assets/design-fonts', 'src/frontend/public/design-fonts'].map(d => path.join(root, d))
for (const d of outDirs) fs.mkdirSync(d, { recursive: true })

// An old user agent makes the CSS API answer with static .ttf URLs, one per
// weight/style, instead of variable woff2 split by unicode-range.
const UA = 'Mozilla/4.0'

export function fontFileName(family, variant) {
  return `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${variant}.ttf`
}

let fetched = 0
for (const { family, variants } of manifest.families) {
  const missing = variants.filter(v => outDirs.some(d => !fs.existsSync(path.join(d, fontFileName(family, v)))))
  if (!missing.length) continue
  const axes = missing.map(v => `${v.endsWith('i') ? 1 : 0},${Number.parseInt(v)}`).sort()
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${axes.join(';')}`
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()
  const blocks = css.split('@font-face').slice(1)
  for (const v of missing) {
    const italic = v.endsWith('i') ? 'italic' : 'normal'
    const weight = String(Number.parseInt(v))
    const block = blocks.find(b => b.includes(`font-style: ${italic}`) && b.includes(`font-weight: ${weight};`))
    const src = block?.match(/url\((https:[^)]+\.ttf)\)/)?.[1]
    if (!src) throw new Error(`No TTF for ${family} ${v} (${url})`)
    const bytes = Buffer.from(await (await fetch(src)).arrayBuffer())
    for (const d of outDirs) fs.writeFileSync(path.join(d, fontFileName(family, v)), bytes)
    fetched++
    console.log(`${family} ${v}  ${(bytes.length / 1024).toFixed(0)} KB`)
  }
}
console.log(`done: ${fetched} downloaded`)
