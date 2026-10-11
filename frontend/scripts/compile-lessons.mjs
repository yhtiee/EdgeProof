#!/usr/bin/env node
/**
 * Compiles the curriculum (content/curriculum.json), the glossary
 * (content/glossary.json), the source registry (content/sources.json) and
 * lesson Markdown (content/lessons/**.md) into
 * static JSON in public/lessons/, so lessons load from Vercel even while the
 * backend sleeps (spec §5, §13). Block syntax: scripts/lesson-parser.mjs.
 *
 * Output:
 *   public/lessons/index.json      curriculum tree with lesson summaries
 *   public/lessons/glossary.json   term -> { term, definition }
 *   public/lessons/<slug>.json     one lesson
 *
 * Only `status: published` lessons are written unless --drafts is passed
 * (npm run dev passes it). Any content error fails the build with its file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LessonError, parseLesson } from './lesson-parser.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = path.join(root, 'content')
const OUT = path.join(root, 'public', 'lessons')
const includeDrafts = process.argv.includes('--drafts')

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : []
  })
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const curriculum = readJson(path.join(CONTENT, 'curriculum.json'))
const glossary = readJson(path.join(CONTENT, 'glossary.json'))
const sources = readJson(path.join(CONTENT, 'sources.json'))
const resolveSource = (id) => ({ id, ...sources[id] })

for (const level of curriculum.levels) {
  for (const id of level.reading ?? []) {
    if (!sources[id]) {
      console.error(`content/curriculum.json: Level ${level.order} reading "${id}" isn't in content/sources.json`)
      process.exit(1)
    }
  }
}
const moduleSlugs = new Set(curriculum.levels.flatMap((l) => l.modules.map((m) => m.slug)))

const lessons = []
const failures = []
for (const file of walk(path.join(CONTENT, 'lessons'))) {
  const rel = path.relative(root, file)
  try {
    const lesson = parseLesson(fs.readFileSync(file, 'utf8'), glossary, sources)
    if (!moduleSlugs.has(lesson.module)) throw new LessonError(`module "${lesson.module}" isn't in curriculum.json`)
    if (lessons.some((l) => l.slug === lesson.slug)) throw new LessonError(`duplicate lesson id "${lesson.slug}"`)
    lessons.push(lesson)
  } catch (err) {
    if (!(err instanceof LessonError)) throw err
    failures.push(`${rel}: ${err.message}`)
  }
}
if (failures.length) {
  console.error(`Lesson content has ${failures.length} problem(s):\n  ${failures.join('\n  ')}`)
  process.exit(1)
}

const shipped = lessons.filter((l) => includeDrafts || l.status === 'published')

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
for (const lesson of shipped) {
  const full = { ...lesson, sources: lesson.sources.map(resolveSource) }
  fs.writeFileSync(path.join(OUT, `${lesson.slug}.json`), JSON.stringify(full))
}
fs.writeFileSync(path.join(OUT, 'glossary.json'), JSON.stringify(glossary))

const index = {
  levels: curriculum.levels.map((level) => ({
    ...level,
    reading: (level.reading ?? []).map(resolveSource),
    modules: level.modules.map((mod) => ({
      ...mod,
      lessons: shipped
        .filter((l) => l.level === level.order && l.module === mod.slug)
        .sort((a, b) => a.order - b.order)
        .map(({ slug, title, order, minutes, status, screens, questions }) => ({
          slug,
          title,
          order,
          minutes,
          status,
          screens: screens.length,
          questions,
        })),
    })),
  })),
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index))
console.log(
  `Compiled ${shipped.length} lesson(s)${includeDrafts ? ' including drafts' : ''} to ${path.relative(root, OUT)}`,
)
