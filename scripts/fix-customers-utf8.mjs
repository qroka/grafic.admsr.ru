import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/customers.vue')
const buf = fs.readFileSync(file)
const fixed = Buffer.from(
  buf.toString('latin1').replace(
    /lines\.length > 3 \? '.{1,3}' : ''/,
    "lines.length > 3 ? '\\u2026' : ''",
  ),
  'utf8',
)
fs.writeFileSync(file, fixed, 'utf8')
console.log('fixed', file)
