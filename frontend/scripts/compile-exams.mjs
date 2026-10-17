#!/usr/bin/env node
/**
 * Compiles exam question banks (content/exams/level-N/*.md) into
 * content/build/exams.json for the backend (`manage.py sync_exams`).
 *
 * Exam questions are NOT lesson practice questions: their answers must never
 * reach the browser (spec AC-5). So this output is written outside public/,
 * is git-ignored, and is only read by the Django sync command.
 *
 * One file per module:
 *
 *   ---
 *   module: how-forex-works
 *   level: 1
 *   ---
 *   ::question{id="hfw-1" lesson="l1-money-and-exchange-rates"}
 *   Prompt?
 *   - [ ] wrong
 *   - [x] right
 *   ? Why (kept on the server; used for reviews and the tutor later).
 *   ::
 *   ::question{id="hfw-2" type="numeric" answer="30000" tolerance="0" unit="naira" lesson="..."}
 *   Prompt?
 *   ? Working.
 *   ::
 *
 * Exams made from them (AC-5: every bank holds at least twice the draw):
 *   m-<module>  module exam: draws 4 of the module's questions, pass 80%
 *   l-<level>   level exam: draws 12 from the whole level, pass 80%
 *   p-<level>   placement exam: draws 20 from the whole level, pass 90%
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(root, 'content')
const OUT = path.join(CONTENT, 'build', 'exams.json')

const MODULE_DRAW = 4
const LEVEL_DRAW = 12
const PLACEMENT_DRAW = 20

const curriculum = JSON.parse(fs.readFileSync(path.join(CONTENT, 'curriculum.json'), 'utf8'))
const modules = new Map(curriculum.levels.flatMap((l) => l.modules.map((m) => [m.slug, { ...m, level: l.order, levelTitle: l.title }])))

// Lesson ids from the lesson files themselves, so tags always point at real lessons.
const lessonModule = new Map()
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []))
    : []
for (const file of walk(path.join(CONTENT, 'lessons'))) {
  const src = fs.readFileSync(file, 'utf8')
  const id = src.match(/^id:\s*(.+)$/m)?.[1].trim()
  const mod = src.match(/^module:\s*(.+)$/m)?.[1].trim()
  if (id) lessonModule.set(id, mod)
}

const attrs = (s = '') => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))
const plain = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, l) => l ?? t).trim()

const failures = []
const questions = []
const byModule = new Map()

for (const file of walk(path.join(CONTENT, 'exams'))) {
  const rel = path.relative(root, file)
  const src = fs.readFileSync(file, 'utf8')
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const meta = Object.fromEntries((fm?.[1] ?? '').split(/\r?\n/).filter(Boolean).map((l) => l.split(':').map((x) => x.trim())))
  const mod = modules.get(meta.module)
  if (!mod) {
    failures.push(`${rel}: unknown module "${meta.module}"`)
    continue
  }
  const list = []
  for (const block of src.matchAll(/^::question\{([^}]*)\}\r?\n([\s\S]*?)^::\s*$/gm)) {
    const a = attrs(block[1])
    const where = `${rel} ${a.id ?? '(no id)'}`
    const lines = block[2].split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    const prompt = plain(lines.filter((l) => !l.startsWith('- [') && !l.startsWith('? ')).join(' '))
    const explanation = plain(lines.filter((l) => l.startsWith('? ')).map((l) => l.slice(2)).join(' '))
    const opts = lines.filter((l) => /^- \[( |x)\] /i.test(l))
    const lessons = (a.lesson ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    const problems = []
    if (!a.id || !/^[a-z0-9-]+$/.test(a.id)) problems.push('needs id="kebab-case"')
    if (questions.some((q) => q.key === a.id)) problems.push('duplicate id')
    if (!prompt) problems.push('no prompt')
    if (!explanation) problems.push('no "? explanation"')
    if (!lessons.length) problems.push('needs lesson="<lesson id>"')
    for (const l of lessons) if (lessonModule.get(l) !== meta.module) problems.push(`lesson "${l}" isn't in module ${meta.module}`)
    const q = { key: a.id, prompt, explanation, lessons, module: meta.module, level: mod.level }
    if ((a.type ?? 'mc') === 'mc') {
      const right = opts.filter((o) => /^- \[x\]/i.test(o))
      if (opts.length < 3) problems.push('multiple choice needs at least 3 options')
      if (right.length !== 1) problems.push('needs exactly one [x] option')
      q.type = 'mc'
      q.options = opts.map((o, i) => ({ key: String.fromCharCode(97 + i), text: plain(o.replace(/^- \[( |x)\] /i, '')) }))
      q.answer = q.options[opts.findIndex((o) => /^- \[x\]/i.test(o))]?.key
    } else if (a.type === 'numeric') {
      q.type = 'numeric'
      q.answer = Number(a.answer)
      q.tolerance = Number(a.tolerance ?? 0)
      q.unit = a.unit ?? ''
      if (!Number.isFinite(q.answer)) problems.push('numeric needs answer="<number>"')
      if (!Number.isFinite(q.tolerance) || q.tolerance < 0) problems.push('tolerance must be 0 or more')
    } else problems.push(`unknown type "${a.type}"`)
    if (problems.length) failures.push(`${where}: ${problems.join('; ')}`)
    else {
      questions.push(q)
      list.push(q)
    }
  }
  if (list.length < MODULE_DRAW * 2) failures.push(`${rel}: ${list.length} questions; a module bank needs at least ${MODULE_DRAW * 2}`)
  byModule.set(meta.module, list)
}

const exams = []
for (const level of curriculum.levels) {
  const pool = []
  for (const m of level.modules) {
    const list = byModule.get(m.slug)
    if (!list) continue
    pool.push(...list)
    exams.push({
      key: `m-${m.slug}`, scope: 'module', level: level.order, module: m.slug,
      title: `${m.title}: module exam`, draw: MODULE_DRAW, pass_mark: 0.8, bank: list.map((q) => q.key),
    })
  }
  if (!pool.length) continue
  const missing = level.modules.filter((m) => !byModule.has(m.slug)).map((m) => m.slug)
  if (missing.length) failures.push(`Level ${level.order}: no question bank for ${missing.join(', ')}`)
  if (pool.length < PLACEMENT_DRAW * 2) failures.push(`Level ${level.order}: ${pool.length} questions; placement needs at least ${PLACEMENT_DRAW * 2}`)
  exams.push(
    { key: `l-${level.order}`, scope: 'level', level: level.order, title: `Level ${level.order}: ${level.title} exam`, draw: LEVEL_DRAW, pass_mark: 0.8, bank: pool.map((q) => q.key) },
    { key: `p-${level.order}`, scope: 'placement', level: level.order, title: `Level ${level.order}: ${level.title} placement exam`, draw: PLACEMENT_DRAW, pass_mark: 0.9, bank: pool.map((q) => q.key) },
  )
}

if (failures.length) {
  console.error(`Exam content has ${failures.length} problem(s):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ questions, exams }, null, 2))
console.log(`Compiled ${questions.length} questions into ${exams.length} exams: ${path.relative(root, OUT)} (backend only)`)
