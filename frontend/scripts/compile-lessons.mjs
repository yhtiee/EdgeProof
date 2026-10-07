#!/usr/bin/env node
/**
 * Compiles lesson Markdown (content/lessons/**.md) into static JSON in
 * public/lessons/, so lessons load from Vercel even while the backend sleeps
 * (spec §5 "Content authoring", §13).
 *
 * Block syntax (AC-1):
 *   plain paragraphs              -> { type: "text" }
 *   ::simulator{kind="..."}       -> { type: "simulator", kind }
 *   ::question{id="..."}          -> { type: "question", id }   (graded on the server)
 *   ::diagram{src="..." alt=".."} -> { type: "diagram", src, alt }
 *   ::takeaway ... ::             -> { type: "takeaway", text }
 *
 * Only lessons with `status: published` are written unless --drafts is passed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(root, 'content', 'lessons')
const OUT = path.join(root, 'public', 'lessons')
const includeDrafts = process.argv.includes('--drafts')

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })
}

function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) throw new Error('missing front matter')
  const meta = Object.fromEntries(
    m[1].split(/\r?\n/).filter(Boolean).map((line) => {
      const i = line.indexOf(':')
      const key = line.slice(0, i).trim()
      const raw = line.slice(i + 1).trim()
      return [key, /^\d+$/.test(raw) ? Number(raw) : raw]
    }),
  )
  return { meta, body: src.slice(m[0].length) }
}

const attrs = (s = '') => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))

function parseBlocks(body) {
  const blocks = []
  const chunks = body.split(/\r?\n\s*\r?\n/)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].trim()
    if (!chunk) continue
    const directive = chunk.match(/^::(\w+)(?:\{([^}]*)\})?\s*$/)
    if (directive) {
      blocks.push({ type: directive[1], ...attrs(directive[2]) })
      continue
    }
    const takeaway = chunk.match(/^::takeaway\s*\r?\n([\s\S]*?)\r?\n::\s*$/)
    if (takeaway) {
      blocks.push({ type: 'takeaway', text: takeaway[1].trim() })
      continue
    }
    blocks.push({ type: 'text', markdown: chunk })
  }
  return blocks.map((b, order) => ({ order, ...b }))
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const index = []
for (const file of walk(SRC)) {
  const { meta, body } = parseFrontMatter(fs.readFileSync(file, 'utf8'))
  if (meta.status !== 'published' && !includeDrafts) continue
  const lesson = { ...meta, blocks: parseBlocks(body) }
  fs.writeFileSync(path.join(OUT, `${meta.id}.json`), JSON.stringify(lesson))
  index.push({ id: meta.id, level: meta.level, module: meta.module, order: meta.order, title: meta.title })
}
index.sort((a, b) => a.level - b.level || a.order - b.order)
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))
console.log(`Compiled ${index.length} lesson(s) to ${path.relative(root, OUT)}`)
