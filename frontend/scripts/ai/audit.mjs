#!/usr/bin/env node
/**
 * Review aid for AI-drafted lessons (review: pending). Writes
 * content/drafts/audit.md listing what a person must check, and recomputes
 * the arithmetic in question explanations.
 *
 *   npm run draft:audit
 *
 * It narrows the review; it doesn't replace it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLesson } from '../lesson-parser.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT = path.join(root, 'content')
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const glossary = readJson(path.join(CONTENT, 'glossary.json'))
const sources = readJson(path.join(CONTENT, 'sources.json'))
const factNumbers = new Set(
  Object.values(sources)
    .flatMap((s) => s.facts ?? [])
    .flatMap((f) => f.match(/\d[\d,.]*/g) ?? []),
)

const text = (inline) => inline.map((t) => (t.t === 'cite' ? `[@${t.id}]` : t.v)).join('')
const num = (s) => Number(s.replace(/[,$%R]|pips?|lots?/g, '').replace('−', '-'))

/** Checks chains like "0.4 × 2R − 0.6 × 1R = 0.8R − 0.6R = +0.2R" and "$20 ÷ $400 = 0.05". */
export function checkArithmetic(sentence) {
  const problems = []
  // Hyphens inside words ("round-trip") aren't minus signs.
  const cleaned = sentence.replace(/(\p{L})-(\p{L})/gu, '$1 $2').replace(/−/g, '-').replace(/[$,]/g, '')
  for (const chain of cleaned.split(/[.;:]\s+(?=[A-Z])/)) {
    const parts = chain.split('=').map((p) => p.trim())
    if (parts.length < 2) continue
    const values = parts.map((p) => {
      const expr = p
        .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
        .replace(/(\d)\s*(R|pips?|lots?|units?|USD|euros?|dollars?)\b/gi, '$1')
        .replace(/[×x*]/g, '*')
        .replace(/÷/g, '/')
        .replace(/[^0-9+\-*/(). ]/g, ' ')
        .trim()
      const tail = expr.match(/[-+(]?\s*[\d.(][\d.\s+\-*/()]*$/)?.[0]?.trim().replace(/\.+$/, '')
      if (!tail || !/\d/.test(tail)) return null
      try {
        const v = Function(`"use strict"; return (${tail})`)()
        return Number.isFinite(v) ? v : null
      } catch {
        return null
      }
    })
    for (let i = 1; i < values.length; i++) {
      const [a, b] = [values[i - 1], values[i]]
      if (a === null || b === null) continue
      const pctLike = /%/.test(parts[i]) && !/%/.test(parts[i - 1])
      const bAdj = pctLike ? b / 100 : b
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a)) && Math.abs(a - bAdj) > 1e-6 * Math.max(1, Math.abs(a)) && Math.abs(a - b) > 0.006) {
        problems.push(`"${parts[i - 1]} = ${parts[i]}" evaluates to ${+a.toFixed(6)} vs ${+b.toFixed(6)}`)
      }
    }
  }
  return problems
}

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })
}

const ABSOLUTE = /\b(always|every|all traders|never|guarantee[sd]?|certainly|impossible|no one|nobody)\b/i
const UNSUPPORTED = /\b(studies show|research shows|experts say|statistics show|data shows|most professionals|according to)\b/i

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const report = ['# AI draft audit', '', `Generated ${new Date().toISOString()}. Every AI-written lesson, with what to check.`, '']
  let lessons = 0
  let flags = 0
  for (const file of walk(path.join(CONTENT, 'lessons'))) {
    const src = fs.readFileSync(file, 'utf8')
    if (!/^generated:/m.test(src)) continue // every AI-written lesson, pending or approved
    lessons++
    const lesson = parseLesson(src, glossary, sources)
    const items = []
    const body = src.replace(/^---[\s\S]*?\r?\n---\r?\n/, '')
    for (const line of body.split(/\r?\n/)) {
      if (/^\s+\S/.test(line) || /^[a-z]/.test(line)) items.push(`**Line starts mid-sentence (a word may be missing):** "${line.trim().slice(0, 80)}"`)
    }
    lesson.screens.forEach((screen, si) => {
      for (const b of screen.blocks) {
        if (b.type === 'question' && b.kind === 'numeric') {
          const exp = text(b.explanation)
          const arith = checkArithmetic(exp)
          arith.forEach((a) => items.push(`**Arithmetic, screen ${si + 1}:** ${a}`))
          const answerShown = (exp.replace(/−\$?/g, '-').replace(/\$/g, '').match(/-?\d[\d,]*\.?\d*/g) ?? []).some((n) => Math.abs(num(n) - b.answer) <= b.tolerance + 1e-9)
          if (!answerShown) items.push(`**Answer ${b.answer} ${b.unit} not shown in the explanation (screen ${si + 1}):** ${exp}`)
          items.push(`Numeric question (screen ${si + 1}): ${text(b.prompt)} → **${b.answer} ${b.unit}** (±${b.tolerance}). Working: ${exp}`)
        }
        if (b.type === 'question' && b.kind === 'mc') {
          const right = b.options.find((o) => o.key === b.answer)
          items.push(`Multiple choice (screen ${si + 1}): ${text(b.prompt)} → **${text(right.inline)}**`)
        }
        const paras = b.type === 'text' || b.type === 'takeaway' ? b.content.flatMap((c) => (c.type === 'p' ? [c.inline] : c.items)) : []
        for (const inline of paras) {
          const t = text(inline)
          const figures = (t.match(/\d[\d,.]*\s*(%|trillion|billion|million|years?)/gi) ?? []).filter(
            (f) => !factNumbers.has(f.match(/\d[\d,.]*/)[0]),
          )
          if (figures.length) items.push(`**Figure to verify (screen ${si + 1}):** ${figures.join(', ')} in "${t}"`)
          if (ABSOLUTE.test(t)) items.push(`Absolute claim (screen ${si + 1}): "${t}"`)
          if (UNSUPPORTED.test(t) && !/\[@/.test(t)) items.push(`**Uncited claim (screen ${si + 1}):** "${t}"`)
          for (const m of t.matchAll(/\[@([a-z0-9-]+)\]/g)) {
            items.push(`Citation ${m[1]} (screen ${si + 1}): "${t.slice(0, 160)}${t.length > 160 ? '…' : ''}" — check against: ${sources[m[1]].about}`)
          }
        }
      }
    })
    const bold = items.filter((i) => i.startsWith('**')).length
    flags += bold
    report.push(`## ${lesson.title}`, '', `\`${path.relative(root, file)}\` · ${lesson.screens.length} screens · ${lesson.sources.length} source(s) · ${bold} flag(s)`, '')
    report.push(...items.map((i) => `- ${i}`), '')
  }
  report.splice(3, 0, `${lessons} lesson(s) pending review, ${flags} flag(s) needing attention (in bold).`, '')
  fs.mkdirSync(path.join(CONTENT, 'drafts'), { recursive: true })
  fs.writeFileSync(path.join(CONTENT, 'drafts', 'audit.md'), report.join('\n'))
  console.log(`${lessons} lesson(s) audited, ${flags} flag(s). Report: content/drafts/audit.md`)
}
