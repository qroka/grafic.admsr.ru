import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd(), 'src')

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.name === 'node_modules')
      continue
    if (ent.isDirectory())
      walk(full)
    else if (ent.name.endsWith('.vue'))
      check(full)
  }
}

function check(file) {
  const buf = fs.readFileSync(file)
  const dec = new TextDecoder('utf-8', { fatal: true })
  try {
    dec.decode(buf)
  } catch (e) {
    console.log('INVALID_UTF8', file, e.message)
    const m = /at index (\d+)/.exec(String(e.message))
    if (m) {
      const i = Number(m[1])
      console.log('  context:', buf.subarray(Math.max(0, i - 20), i + 20).toString('hex'))
    }
  }
  // windows-1251 misread as latin1 often has 0xC3 0xXX patterns
  if (buf.includes(0xC3) && buf.toString('utf8').includes(''))
    console.log('SUSPECT_MOJIBAKE', file)
}

walk(root)
