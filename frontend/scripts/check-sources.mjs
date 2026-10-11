#!/usr/bin/env node
/**
 * Checks every link in content/sources.json. Run before publishing and when
 * adding sources: npm run sources:check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sources = JSON.parse(fs.readFileSync(path.join(root, 'content', 'sources.json'), 'utf8'))

let failed = 0
// One request at a time: parallel bursts get rate-limited (Open Library answers 429).
for (const [id, s] of Object.entries(sources)) {
  try {
    const res = await fetch(s.url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (EdgeProof source check)' },
      signal: AbortSignal.timeout(30_000),
    })
    const ok = res.status < 400 || res.status === 403 // some official sites block scripts but exist
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${res.status} ${id} ${s.url}${res.status === 403 ? ' (blocks scripts; check in a browser)' : ''}`)
  } catch (err) {
    failed++
    console.log(`FAIL ---  ${id} ${s.url} (${err.cause?.code ?? err.name})`)
  }
  await new Promise((r) => setTimeout(r, 500))
}
process.exit(failed ? 1 : 0)
