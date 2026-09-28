#!/usr/bin/env node
/**
 * Copies the shared Design Studio core (src/shared/design-core/) into the two
 * packages that use it. Strapi (CommonJS tsc, rootDir = src/backend) and Nuxt
 * each compile only their own tree, so the code is copied rather than linked.
 *
 *   node scripts/design/sync-design-core.mjs          # write the copies
 *   node scripts/design/sync-design-core.mjs --check  # exit 1 if a copy drifted
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const src = path.join(root, 'src/shared/design-core')
const targets = ['src/backend/src/utils/design-core', 'src/frontend/lib/design-core'].map(t => path.join(root, t))
const HEADER = '// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.\n'

const check = process.argv.includes('--check')
const files = fs.readdirSync(src).filter(f => /\.(ts|json)$/.test(f) && !f.includes('.test.'))
let drift = 0
for (const t of targets) {
  fs.mkdirSync(t, { recursive: true })
  for (const f of files) {
    const body = fs.readFileSync(path.join(src, f), 'utf8')
    const want = f.endsWith('.ts') ? HEADER + body : body
    const dest = path.join(t, f)
    const have = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null
    if (have === want) continue
    drift++
    if (check) console.error(`drift: ${path.relative(root, dest)}`)
    else fs.writeFileSync(dest, want)
  }
  for (const f of fs.readdirSync(t)) {
    if (!files.includes(f)) {
      drift++
      if (check) console.error(`stale: ${path.relative(root, path.join(t, f))}`)
      else fs.rmSync(path.join(t, f))
    }
  }
}
if (check && drift) process.exit(1)
console.log(check ? 'design-core copies are in sync' : `design-core synced (${drift} file(s) written)`)
