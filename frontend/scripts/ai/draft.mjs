#!/usr/bin/env node
/**
 * AI-assisted lesson drafting with Gemini (authoring time only; nothing here
 * runs in the app). See content/README.md "Drafting with AI".
 *
 *   npm run draft -- outline <module-slug>        propose the module's lessons
 *   npm run draft -- lesson  <module-slug> <n>    draft lesson n from the outline
 *   npm run draft -- module  <module-slug>        outline, then every lesson
 *   npm run draft -- all [--level N]              every module not yet drafted (resumable)
 *   flags: --force (overwrite)  --grounded (try Google Search grounding)
 *
 * Guardrails (spec §1 "Honesty over hype", §5, §17 content rights):
 *   - Citations only by id from content/sources.json; figures only from a
 *     source's "facts". The parser rejects unknown ids and glossary terms.
 *   - No AI-written quotes: drafts containing ::quote are rejected.
 *   - Drafts are saved as status: draft with review: pending, and the
 *     compiler refuses to publish an AI draft until review: done.
 *   - Web sources found with --grounded are written to a suggestions file
 *     for a person to check; they are never added to the registry.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LessonError, SIMULATORS, parseLesson } from '../lesson-parser.mjs'
import { QuotaError, generate, loadKey, resolveLinks } from './gemini.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT = path.join(root, 'content')
// Free-tier quotas are per model, so a run moves to the next model when one is used up.
// Each lesson's front matter records the model that drafted it.
const MODELS = (process.env.GEMINI_MODELS ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash,gemini-3.8-flash,gemini-3-flash-preview')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean)
let MODEL = MODELS[0]
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

const [cmd, moduleSlug, nArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const FORCE = process.argv.includes('--force')
let GROUNDED = process.argv.includes('--grounded')

const curriculum = readJson(path.join(CONTENT, 'curriculum.json'))
const glossary = readJson(path.join(CONTENT, 'glossary.json'))
const sources = readJson(path.join(CONTENT, 'sources.json'))
const levelArg = process.argv.includes('--level') ? Number(process.argv[process.argv.indexOf('--level') + 1]) : null

// The module being worked on; `all` moves these through every module in turn.
let level = curriculum.levels.find((l) => l.modules.some((m) => m.slug === moduleSlug))
let mod = level?.modules.find((m) => m.slug === moduleSlug)
let outlinePath = mod ? path.join(CONTENT, 'outlines', `${mod.slug}.json`) : null

function useModule(l, m) {
  level = l
  mod = m
  outlinePath = path.join(CONTENT, 'outlines', `${m.slug}.json`)
}

if (!['outline', 'lesson', 'module', 'all'].includes(cmd) || (cmd !== 'all' && !mod)) {
  console.error('Usage: npm run draft -- <outline|lesson|module> <module-slug> [n] [--force] [--grounded]')
  console.error('       npm run draft -- all [--level N] [--grounded]')
  if (moduleSlug && !mod && cmd !== 'all') console.error(`Unknown module "${moduleSlug}". Modules are listed in content/curriculum.json.`)
  process.exit(1)
}

const key = loadKey(root)

/** Lessons already written for a module (hand-written or drafted), read from front matter. */
function existingLessons(moduleSlug) {
  const found = []
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.md')) {
        const fm = fs.readFileSync(p, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
        const get = (k) => fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim()
        if (get('module') === moduleSlug) found.push({ slug: get('id'), title: get('title'), order: Number(get('order')) })
      }
    }
  }
  walk(path.join(CONTENT, 'lessons'))
  return found.sort((a, b) => a.order - b.order)
}
const BANNED = /\b(proven|guaranteed|profitable strategy|signals?|winning|beat the market|financial freedom|to the moon|we recommend|you should)\b/i

/* ------------------------------------------------------------------ */

const STYLE = `
You write lessons for EdgeProof, a free forex education app. Its principles:
- Honesty over hype: real odds and real uncertainty. Never promise or imply profits.
- Education only: no trade calls, no signals, no personal financial advice.
- Describe, don't instruct: "Your rule allows 1% per trade", never "you should" or "we recommend".
- Plain words for a reading age of about 12. Explain every term the first time.
- Sentence case. Numbers carry units: 2.4%, $150, 20 pips, 0.5 lots.
- Signs (+ and −) only on results and changes: +0.21R, −1.0R, a +25% gain, a −20% drawdown. Never on prices, amounts or counts: write "1 euro costs $1.0850", not "+1.00 euro". Use the true minus sign (−).
- Classifications that differ between sources (which pairs are "exotic", session hours) are described as common usage, not as fixed rules. Never write "always" or "every" unless it is strictly true.
- Never use: proven, guaranteed, profitable strategy, signal(s), winning, beat the market, financial freedom, to the moon, income claims, emoji.
- Learners are adults on a long journey; never talk down, never flatter.
`.trim()

const sourceCatalogue = () =>
  Object.entries(sources)
    .map(([id, s]) => {
      const facts = s.facts?.length ? `\n    facts you may state: ${s.facts.map((f) => `"${f}"`).join('; ')}` : ''
      return `- ${id}: ${s.author}${s.year ? ` (${s.year})` : ''}, "${s.title}". About: ${s.about}${facts}`
    })
    .join('\n')

const CITATION_RULES = `
Citing (strict):
- Cite only these sources, by id, inline as [@id] right after the idea you take from them.
- Cite sparingly: once per screen at most, after the main idea that comes from the source. Never cite every sentence, and don't cite basic definitions twice.
- Paraphrase in your own words. Never write direct quotes, page numbers or chapter numbers.
- State a statistic or figure only if it appears word-for-word in that source's "facts" list, and cite it.
- If no listed source supports an idea, explain it without a citation. Never invent a source, author, book, study, date or number.
- You may describe what a named author argues only when the source's "About" supports it.
`.trim()

/* ------------------------------------------------------------------ */

async function call(opts) {
  for (;;) {
    try {
      return await generate({ key, model: MODEL, grounded: GROUNDED, ...opts })
    } catch (err) {
      if (!(err instanceof QuotaError)) throw err
      if (GROUNDED) {
        console.log("  Google Search grounding isn't available on this key's plan; continuing without it.")
        GROUNDED = false
        continue
      }
      const next = MODELS[MODELS.indexOf(MODEL) + 1]
      if (!next) throw err
      console.log(`  ${MODEL} quota used up; switching to ${next}`)
      MODEL = next
    }
  }
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return JSON.parse(fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
}

async function saveSuggestions(name, grounding) {
  if (!grounding.length) return
  const links = await resolveLinks(grounding)
  const dir = path.join(CONTENT, 'drafts')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${name}.web-sources.json`)
  fs.writeFileSync(file, JSON.stringify({ note: 'Found by Google Search grounding. Check each before adding it to sources.json.', links }, null, 2))
  console.log(`  web sources to review: ${path.relative(root, file)}`)
}

/* ------------------------------------------------------------------ */

async function outline() {
  if (fs.existsSync(outlinePath) && !FORCE) {
    console.log(`Outline exists: ${path.relative(root, outlinePath)} (use --force to redo)`)
    return readJson(outlinePath)
  }
  const siblings = level.modules.map((m) => `${m.order}. ${m.title}${m.slug === mod.slug ? '  <- this module' : ''}`).join('\n')
  const already = existingLessons(mod.slug)
  // The whole course, so topics stay in their own module and nothing is taught twice.
  const course = curriculum.levels
    .map((l) => {
      const mods = l.modules
        .map((m) => {
          const titles = existingLessons(m.slug).map((x) => x.title)
          return `  - ${m.title}${m.slug === mod.slug ? '  <- this module' : ''}${titles.length ? ` (written: ${titles.join('; ')})` : ''}`
        })
        .join('\n')
      return `Level ${l.order}: ${l.title}\n${mods}`
    })
    .join('\n')
  const alreadyText = already.length
    ? `\nLessons already written for this module (don't repeat them; plan lessons that come after):\n${already.map((l) => `- ${l.title}`).join('\n')}\n`
    : ''
  const prompt = `
Plan the lessons for one module of the EdgeProof Academy.

Level ${level.order}: ${level.title}
Modules in this level:
${siblings}

The whole course (topics belong to the module named for them; don't plan a lesson another module covers):
${course}

Module to plan: "${mod.title}" (slug ${mod.slug})${mod.covers ? `\nThe course specification says this module covers: ${mod.covers} Make sure the lessons cover all of it.` : ''}
${alreadyText}
Rules:
- ${already.length ? '1 to 3 more lessons' : '2 to 4 lessons'}, in teaching order, each 4 to 6 minutes, each teaching one idea.
- Stay inside this module's topic. If an idea has its own module elsewhere (for example position sizing, expectancy or drawdown in Level 2), mention it at most in passing and don't plan a lesson on it.
- Interactive simulators available (use one only where it truly fits, else null): ${SIMULATORS.join(', ')}.
- Glossary terms that already exist: ${Object.keys(glossary).join(', ')}.
  You may propose up to 4 new terms this module needs, each with a one-sentence plain definition.

${CITATION_RULES}

Sources:
${sourceCatalogue()}

Return JSON only:
{"lessons":[{"order":1,"slug":"l${level.order}-short-kebab-slug","title":"Sentence case title","objective":"What the learner can do after","screens":["one line per planned screen"],"simulator":null,"sources":["source-id"]}],
 "new_glossary_terms":[{"term":"lowercase term","definition":"One plain sentence."}]}
`.trim()

  console.log(`Outlining ${mod.title} with ${MODEL}${GROUNDED ? ' (grounded)' : ''}…`)
  const res = await call({ system: STYLE, prompt, json: true, temperature: 0.5 })
  const data = extractJson(res.text)
  const problems = []
  for (const l of data.lessons ?? []) {
    // Normalise the slug to "l<level>-kebab-case".
    const base = String(l.slug || l.title || '')
      .toLowerCase()
      .replace(/^l\d-/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    l.slug = `l${level.order}-${base}`
    if (base.length < 3) problems.push(`bad slug for "${l.title}"`)
    if (l.simulator && !SIMULATORS.includes(l.simulator)) l.simulator = null
    l.sources = (l.sources ?? []).filter((id) => sources[id])
  }
  if (!data.lessons?.length || problems.length) throw new Error(`Outline rejected: ${problems.join('; ') || 'no lessons'}`)

  const out = {
    module: mod.slug,
    level: level.order,
    generated: { model: res.model, at: new Date().toISOString(), grounded: GROUNDED },
    review: 'pending',
    lessons: data.lessons
      .filter((l) => !already.some((a) => a.slug === l.slug))
      .map((l, i) => ({ ...l, order: (already.at(-1)?.order ?? 0) + i + 1 })),
  }
  fs.mkdirSync(path.dirname(outlinePath), { recursive: true })
  fs.writeFileSync(outlinePath, JSON.stringify(out, null, 2) + '\n')

  const newTerms = (data.new_glossary_terms ?? []).filter((t) => t.term && !glossary[t.term.toLowerCase()])
  if (newTerms.length) {
    const sugPath = path.join(CONTENT, 'glossary.suggested.json')
    const existing = fs.existsSync(sugPath) ? readJson(sugPath) : {}
    for (const t of newTerms) existing[t.term.toLowerCase()] ??= { term: t.term, definition: t.definition, from: mod.slug }
    fs.writeFileSync(sugPath, JSON.stringify(existing, null, 2) + '\n')
    console.log(`  ${newTerms.length} new glossary term(s) proposed in content/glossary.suggested.json`)
  }
  await saveSuggestions(`${mod.slug}.outline`, res.grounding)
  console.log(`  saved ${path.relative(root, outlinePath)}: ${out.lessons.map((l) => l.title).join(' | ')}`)
  return out
}

/* ------------------------------------------------------------------ */

function example() {
  const p = path.join(CONTENT, 'lessons', 'level-2', '04-position-sizing-01.md')
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/^---[\s\S]*?---\r?\n/, '') : ''
}

function frontMatter(entry, res) {
  return [
    '---',
    `id: ${entry.slug}`,
    `level: ${level.order}`,
    `module: ${mod.slug}`,
    `order: ${entry.order}`,
    `title: ${entry.title}`,
    'status: draft',
    `minutes: ${entry.minutes ?? 5}`,
    `generated: ${res.model} ${new Date().toISOString().slice(0, 10)}`,
    'review: pending',
    '---',
    '',
  ].join('\n')
}

function check(body, entry, res) {
  const problems = []
  let parsed
  try {
    parsed = parseLesson(frontMatter(entry, res) + body, glossary, sources)
  } catch (err) {
    if (!(err instanceof LessonError)) throw err
    problems.push(err.message)
  }
  if (/^::quote/m.test(body)) problems.push('contains ::quote; AI drafts may not include quotes')
  const banned = body.match(BANNED)
  if (banned) problems.push(`uses the banned phrase "${banned[0]}"`)
  if (/[A-Za-z]\s-\d/.test(body)) problems.push('uses a hyphen as a minus sign; use − (U+2212)')
  const broken = body.split(/\r?\n/).filter((l) => /^\s+[a-z]/.test(l) || /^[a-z](?![a-z-]*\])/.test(l.trim()) && !/^- /.test(l))
  if (broken.length) problems.push(`has line(s) starting mid-sentence: "${broken[0].trim().slice(0, 40)}"`)
  if (parsed) {
    if (parsed.screens.length < 4 || parsed.screens.length > 8) problems.push(`has ${parsed.screens.length} screens; use 4 to 7`)
    if (!parsed.questions) problems.push('has no practice question')
    // Not a hard rule: forcing a citation invites a wrong one. Missing citations are reported instead.
    if (!parsed.sources.length) console.log('  note: cites no source')
    const dense = parsed.screens.filter((sc) => JSON.stringify(sc).split('"cite"').length - 1 > 1).length
    if (dense) problems.push(`${dense} screen(s) cite more than once; cite at most once per screen`)
    if (/[+]\d+(\.\d+)? (euro|dollar|pound|yen|unit|lot)/i.test(body)) problems.push('puts a + sign on an amount; signs are only for results and changes')
    if (!parsed.screens.some((s) => s.blocks.some((b) => b.type === 'takeaway'))) problems.push('has no ::takeaway')
  }
  return problems
}

async function lesson(entry) {
  const dir = path.join(CONTENT, 'lessons', `level-${level.order}`)
  const file = path.join(dir, `${String(mod.order).padStart(2, '0')}-${mod.slug}-${entry.order}.md`)
  const existing = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(`\nid: ${entry.slug}\n`))
  if ((fs.existsSync(file) || existing) && !FORCE) {
    console.log(`Lesson "${entry.title}" already exists (use --force to redraft)`)
    return
  }

  const prompt = `
Write one lesson in EdgeProof's Markdown block format. Output only the lesson body, no front matter, no code fences.

Lesson: "${entry.title}" (Level ${level.order}: ${level.title}; module: ${mod.title})
Objective: ${entry.objective}
Planned screens:
${(entry.screens ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n')}
${entry.simulator ? `Include the simulator on the screen where the learner should try it: ::simulator{kind="${entry.simulator}"}` : 'No simulator.'}
Prefer these sources: ${(entry.sources ?? []).join(', ') || 'any listed source that fits'}

Format rules:
- 4 to 7 screens, separated by a line containing only ---
- At most 3 short paragraphs per screen. "- " lists are allowed.
- Inline: **bold**, glossary links [[term]] or [[term|shown text]] using ONLY these terms: ${Object.keys(glossary).join(', ')}
- 1 to 3 practice questions, each alone on its own screen:
  ::question{type="mc"}
  Prompt
  - [ ] wrong option
  - [x] the one right option
  ? Explanation of why, one or two sentences.
  ::
  or ::question{type="numeric" answer="25" tolerance="0.5" unit="%"} ... ? Explanation showing the working. ::
  Check every calculation twice; the explanation must show the arithmetic.
- End with a ::takeaway block (one or two sentences) and close it with ::
- Never use ::quote.

${CITATION_RULES}

Sources:
${sourceCatalogue()}

A finished lesson in this format, for style:
${example()}
`.trim()

  console.log(`Drafting "${entry.title}" with ${MODEL}${GROUNDED ? ' (grounded)' : ''}…`)
  let res = await call({ system: STYLE, prompt, temperature: 0.4 })
  let body = res.text.replace(/^```(?:markdown|md)?\s*|```\s*$/g, '').trim() + '\n'
  let problems = check(body, entry, res)

  if (problems.length) {
    console.log(`  fixing: ${problems.join('; ')}`)
    res = await call({
      system: STYLE,
      prompt: `${prompt}\n\nYour previous draft had these problems:\n- ${problems.join('\n- ')}\n\nPrevious draft:\n${body}\n\nReturn the corrected lesson body only.`,
      temperature: 0.2,
    })
    body = res.text.replace(/^```(?:markdown|md)?\s*|```\s*$/g, '').trim() + '\n'
    problems = check(body, entry, res)
  }
  if (problems.length) {
    const rejected = path.join(CONTENT, 'drafts', `${entry.slug}.rejected.md`)
    fs.mkdirSync(path.dirname(rejected), { recursive: true })
    fs.writeFileSync(rejected, `<!-- Rejected: ${problems.join('; ')} -->\n${body}`)
    console.log(`  still failing (${problems.join('; ')}); saved for reference at ${path.relative(root, rejected)}`)
    return
  }

  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, frontMatter(entry, res) + body)
  await saveSuggestions(entry.slug, res.grounding)
  console.log(`  saved ${path.relative(root, file)} (review: pending)`)
}

/* ------------------------------------------------------------------ */

async function runAll() {
  const modules = curriculum.levels
    .filter((l) => !levelArg || l.order === levelArg)
    .flatMap((l) => l.modules.map((m) => [l, m]))
  let n = 0
  for (const [l, m] of modules) {
    n++
    useModule(l, m)
    const plan = fs.existsSync(outlinePath) ? readJson(outlinePath) : await outline()
    const have = new Set(existingLessons(m.slug).map((x) => x.slug))
    const missing = plan.lessons.filter((x) => !have.has(x.slug))
    if (!missing.length) {
      console.log(`[${n}/${modules.length}] ${m.title}: all ${plan.lessons.length} planned lessons exist`)
      continue
    }
    console.log(`[${n}/${modules.length}] ${m.title}: drafting ${missing.length} lesson(s)`)
    for (const entry of missing) await lesson(entry)
  }
}

try {
  if (cmd === 'all') {
    await runAll()
    process.exit(0)
  }
  const plan = cmd === 'lesson' && fs.existsSync(outlinePath) ? readJson(outlinePath) : await outline()
  if (cmd === 'lesson') {
    const entry = plan.lessons.find((l) => l.order === Number(nArg))
    if (!entry) throw new Error(`No lesson ${nArg} in ${path.relative(root, outlinePath)}`)
    await lesson(entry)
  } else if (cmd === 'module') {
    for (const entry of plan.lessons) await lesson(entry)
  }
} catch (err) {
  console.error(
    err instanceof QuotaError
      ? `Gemini quota reached: ${err.message}\nEverything drafted so far is saved. Run the same command again later to continue.`
      : err.message,
  )
  process.exit(1)
}
