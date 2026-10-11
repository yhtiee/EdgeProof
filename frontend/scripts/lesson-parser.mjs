/**
 * Lesson Markdown parser (spec §5 "Content authoring", AC-1, AC-4).
 *
 * A lesson is front matter plus screens separated by a line containing only
 * `---`. Each screen holds one or more blocks:
 *
 *   Plain paragraphs and "- " lists       -> text
 *   ::simulator{kind="position-size"}      -> simulator (see SIMULATORS below)
 *   ::diagram{src="/lessons/img/x.svg" alt="..."}
 *   ::question{type="mc"}                  -> multiple choice
 *   Prompt text
 *   - [ ] wrong option
 *   - [x] right option
 *   ? Explanation shown after checking.
 *   ::
 *   ::question{type="numeric" answer="0.05" tolerance="0.005" unit="lots"}
 *   Prompt text
 *   ? Explanation.
 *   ::
 *   ::takeaway
 *   One or two sentences.
 *   ::
 *
 *   ::quote{source="douglas-trading-in-the-zone"}
 *   A short quote, 40 words at most, added and checked by a person.
 *   ::
 *
 * Inline: **bold**, [label](https://url), [[glossary-term]] or [[term|label]],
 * and citations [@source-id] pointing at content/sources.json.
 *
 * Practice questions are not exam questions: their answers ship in the
 * static JSON so lessons work offline. Exam questions stay on the server (AC-5).
 */

export const SIMULATORS = [
  'position-size',
  'expectancy',
  'drawdown',
  'leverage',
  'pip-value',
  'trading-cost',
  'swap',
  'gap',
  'coin-flip',
  'sample-size',
  'risk-of-ruin',
  'compounding',
  'overfitting',
  'candlestick',
  'moving-average',
  'session-clock',
  'currency-exposure',
]

export class LessonError extends Error {}

const attrs = (s = '') => Object.fromEntries([...s.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))

export function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) throw new LessonError('missing front matter')
  const meta = Object.fromEntries(
    m[1]
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((line) => {
        const i = line.indexOf(':')
        const key = line.slice(0, i).trim()
        const raw = line.slice(i + 1).trim()
        return [key, /^\d+$/.test(raw) ? Number(raw) : raw]
      }),
  )
  for (const key of ['id', 'level', 'module', 'order', 'title', 'status']) {
    if (meta[key] === undefined || meta[key] === '') throw new LessonError(`front matter is missing "${key}"`)
  }
  if (!['draft', 'published'].includes(meta.status)) throw new LessonError('status must be draft or published')
  // AI-drafted lessons (scripts/ai/draft.mjs) can't ship until a person has
  // checked every fact, figure, citation and calculation.
  if (meta.generated && meta.status === 'published' && meta.review !== 'done') {
    throw new LessonError('AI-drafted lesson: set "review: done" after checking it before publishing')
  }
  return { meta, body: src.slice(m[0].length) }
}

export const MAX_QUOTE_WORDS = 40

/**
 * Inline tokens: text, strong, link, term, cite. `glossary` and `sources`
 * are optional; when given, unknown terms and source ids are errors.
 * Cited ids are added to `cited` when it is passed.
 */
export function parseInline(text, glossary, sources, cited) {
  const tokens = []
  const re = /\*\*(.+?)\*\*|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[@([a-z0-9-]+)\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) tokens.push({ t: 'text', v: text.slice(last, m.index) })
    if (m[1] !== undefined) tokens.push({ t: 'strong', v: m[1] })
    else if (m[2] !== undefined) {
      const term = m[2].trim().toLowerCase()
      if (glossary && !glossary[term]) throw new LessonError(`unknown glossary term "${term}"`)
      tokens.push({ t: 'term', term, v: (m[3] ?? m[2]).trim() })
    } else if (m[4] !== undefined) {
      if (sources && !sources[m[4]]) throw new LessonError(`unknown source "${m[4]}" (add it to content/sources.json)`)
      cited?.add(m[4])
      tokens.push({ t: 'cite', id: m[4] })
    } else tokens.push({ t: 'link', href: m[6], v: m[5] })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ t: 'text', v: text.slice(last) })
  return tokens
}

const inl = (text, ctx) => parseInline(text, ctx.glossary, ctx.sources, ctx.cited)

function parseText(lines, ctx) {
  const content = []
  let para = []
  let list = null
  const flushPara = () => {
    if (para.length) content.push({ type: 'p', inline: inl(para.join(' '), ctx) })
    para = []
  }
  const flushList = () => {
    if (list) content.push({ type: 'ul', items: list.map((i) => inl(i, ctx)) })
    list = null
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
    } else if (line.startsWith('- ')) {
      flushPara()
      ;(list ??= []).push(line.slice(2))
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return content
}

function parseQuestion(a, lines, ctx) {
  const prompt = []
  const options = []
  const explanation = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const opt = line.match(/^- \[( |x)\] (.+)$/i)
    if (opt) options.push({ key: String.fromCharCode(97 + options.length), correct: opt[1].toLowerCase() === 'x', text: opt[2] })
    else if (line.startsWith('? ')) explanation.push(line.slice(2))
    else prompt.push(line)
  }
  if (!prompt.length) throw new LessonError('question has no prompt')
  if (!explanation.length) throw new LessonError('question has no "? explanation" line')

  const base = {
    type: 'question',
    prompt: inl(prompt.join(' '), ctx),
    explanation: inl(explanation.join(' '), ctx),
  }
  if (a.type === 'mc') {
    const right = options.filter((o) => o.correct)
    if (options.length < 2) throw new LessonError('multiple-choice question needs at least 2 options')
    if (right.length !== 1) throw new LessonError('multiple-choice question needs exactly one [x] option')
    return {
      ...base,
      kind: 'mc',
      options: options.map((o) => ({ key: o.key, inline: inl(o.text, ctx) })),
      answer: right[0].key,
    }
  }
  if (a.type === 'numeric') {
    const answer = Number(a.answer)
    const tolerance = Number(a.tolerance ?? 0)
    if (!Number.isFinite(answer)) throw new LessonError('numeric question needs answer="<number>"')
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new LessonError('tolerance must be a number, 0 or more')
    return { ...base, kind: 'numeric', answer, tolerance, unit: a.unit ?? '' }
  }
  throw new LessonError('question type must be "mc" or "numeric"')
}

function parseScreen(lines, ctx) {
  const blocks = []
  let text = []
  const flushText = () => {
    const content = parseText(text, ctx)
    if (content.length) blocks.push({ type: 'text', content })
    text = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const d = line.match(/^::(\w+)(?:\{([^}]*)\})?$/)
    if (!d) {
      text.push(lines[i])
      continue
    }
    flushText()
    const [, name, rawAttrs] = d
    const a = attrs(rawAttrs)
    if (name === 'simulator') {
      if (!SIMULATORS.includes(a.kind)) throw new LessonError(`unknown simulator "${a.kind}"`)
      blocks.push({ type: 'simulator', kind: a.kind })
    } else if (name === 'diagram') {
      if (!a.src || !a.alt) throw new LessonError('diagram needs src and alt')
      blocks.push({ type: 'diagram', src: a.src, alt: a.alt })
    } else if (name === 'quote') {
      if (!a.source) throw new LessonError('quote needs source="<id from content/sources.json>"')
      if (ctx.sources && !ctx.sources[a.source]) throw new LessonError(`unknown source "${a.source}"`)
      const end = lines.findIndex((l, j) => j > i && l.trim() === '::')
      if (end === -1) throw new LessonError('::quote is not closed with "::"')
      const text = lines.slice(i + 1, end).map((l) => l.trim()).filter(Boolean).join(' ')
      const words = text.split(/\s+/).filter(Boolean).length
      if (!words) throw new LessonError('quote is empty')
      if (words > MAX_QUOTE_WORDS) throw new LessonError(`quote is ${words} words; keep quotes to ${MAX_QUOTE_WORDS} or fewer`)
      ctx.cited?.add(a.source)
      blocks.push({ type: 'quote', text, source: a.source, ...(a.page ? { page: a.page } : {}) })
      i = end
    } else if (name === 'question' || name === 'takeaway') {
      const end = lines.findIndex((l, j) => j > i && l.trim() === '::')
      if (end === -1) throw new LessonError(`::${name} is not closed with "::"`)
      const inner = lines.slice(i + 1, end)
      blocks.push(
        name === 'question' ? parseQuestion(a, inner, ctx) : { type: 'takeaway', content: parseText(inner, ctx) },
      )
      i = end
    } else {
      throw new LessonError(`unknown block "::${name}"`)
    }
  }
  flushText()
  return { blocks }
}

export function parseLesson(src, glossary, sources) {
  const ctx = { glossary, sources, cited: new Set() }
  const { meta, body } = parseFrontMatter(src)
  const screens = []
  let current = []
  for (const line of body.split(/\r?\n/)) {
    if (line.trim() === '---') {
      screens.push(current)
      current = []
    } else current.push(line)
  }
  screens.push(current)
  const parsed = screens.map((s) => parseScreen(s, ctx)).filter((s) => s.blocks.length)
  if (!parsed.length) throw new LessonError('lesson has no content')
  const questions = parsed.flatMap((s) => s.blocks.filter((b) => b.type === 'question')).length
  if (parsed.some((s) => s.blocks.filter((b) => b.type === 'question').length > 1)) {
    throw new LessonError('put each question on its own screen')
  }
  return {
    slug: meta.id,
    level: meta.level,
    module: meta.module,
    order: meta.order,
    title: meta.title,
    status: meta.status,
    minutes: meta.minutes ?? Math.max(2, parsed.length),
    questions,
    sources: [...ctx.cited],
    screens: parsed,
  }
}
