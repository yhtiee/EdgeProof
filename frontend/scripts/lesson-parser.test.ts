import { describe, expect, it } from 'vitest'
// @ts-expect-error - plain ESM build script without type declarations
import { LessonError, parseInline, parseLesson } from './lesson-parser.mjs'

const GLOSSARY = { pip: { term: 'pip', definition: 'The smallest standard price step.' } }
const SOURCES = { 'douglas-trading-in-the-zone': { author: 'Mark Douglas', title: 'Trading in the Zone' } }

const lesson = (body: string, status = 'draft') =>
  `---\nid: l1-test\nlevel: 1\nmodule: m\norder: 1\ntitle: Test\nstatus: ${status}\n---\n${body}`

describe('parseInline', () => {
  it('parses bold, links and glossary terms', () => {
    expect(parseInline('A **big** [[pip]] and [ESMA](https://esma.europa.eu).', GLOSSARY)).toEqual([
      { t: 'text', v: 'A ' },
      { t: 'strong', v: 'big' },
      { t: 'text', v: ' ' },
      { t: 'term', term: 'pip', v: 'pip' },
      { t: 'text', v: ' and ' },
      { t: 'link', href: 'https://esma.europa.eu', v: 'ESMA' },
      { t: 'text', v: '.' },
    ])
  })
  it('rejects unknown glossary terms', () => {
    expect(() => parseInline('[[lambo]]', GLOSSARY)).toThrow(LessonError)
  })
})

describe('parseLesson', () => {
  it('splits screens on --- and parses each block type', () => {
    const l = parseLesson(
      lesson(`Intro paragraph.

- one
- two

---

::simulator{kind="position-size"}

---

::question{type="mc"}
Which is right?
- [ ] No
- [x] Yes
? Because.
::

---

::question{type="numeric" answer="0.05" tolerance="0.005" unit="lots"}
How many lots?
? 10 / 200 = 0.05.
::

::takeaway
Size comes from the stop.
::`),
      GLOSSARY,
    )
    expect(l.screens).toHaveLength(4)
    expect(l.screens[0].blocks[0].content.map((c: { type: string }) => c.type)).toEqual(['p', 'ul'])
    expect(l.screens[1].blocks[0]).toEqual({ type: 'simulator', kind: 'position-size' })
    expect(l.screens[2].blocks[0]).toMatchObject({ kind: 'mc', answer: 'b' })
    expect(l.screens[3].blocks[0]).toMatchObject({ kind: 'numeric', answer: 0.05, tolerance: 0.005, unit: 'lots' })
    expect(l.screens[3].blocks[1].type).toBe('takeaway')
    expect(l.questions).toBe(2)
  })

  it('reports content mistakes as LessonError', () => {
    const bad = [
      '::simulator{kind="lambo"}',
      '::question{type="mc"}\nQ?\n- [x] A\n- [x] B\n? E\n::',
      '::question{type="mc"}\nQ?\n- [ ] A\n- [x] B\n::',
      '::takeaway\nunclosed',
      '::question{type="numeric"}\nQ?\n? E\n::',
    ]
    for (const body of bad) expect(() => parseLesson(lesson(body), GLOSSARY)).toThrow(LessonError)
  })
})

describe('citations and quotes', () => {
  it('records cited sources and validates ids', () => {
    const l = parseLesson(lesson('Traders think in probabilities [@douglas-trading-in-the-zone].'), GLOSSARY, SOURCES)
    expect(l.sources).toEqual(['douglas-trading-in-the-zone'])
    expect(l.screens[0].blocks[0].content[0].inline[1]).toEqual({ t: 'cite', id: 'douglas-trading-in-the-zone' })
    expect(() => parseLesson(lesson('Made up [@invented-book].'), GLOSSARY, SOURCES)).toThrow(LessonError)
  })

  it('accepts short attributed quotes and rejects long or unsourced ones', () => {
    const ok = parseLesson(
      lesson('::quote{source="douglas-trading-in-the-zone" page="12"}\nA short line.\n::'),
      GLOSSARY,
      SOURCES,
    )
    expect(ok.screens[0].blocks[0]).toEqual({
      type: 'quote',
      text: 'A short line.',
      source: 'douglas-trading-in-the-zone',
      page: '12',
    })
    const long = Array.from({ length: 41 }, () => 'word').join(' ')
    expect(() =>
      parseLesson(lesson(`::quote{source="douglas-trading-in-the-zone"}\n${long}\n::`), GLOSSARY, SOURCES),
    ).toThrow(/41 words/)
    expect(() => parseLesson(lesson('::quote\nNo source.\n::'), GLOSSARY, SOURCES)).toThrow(LessonError)
  })
})

describe('AI drafts', () => {
  const ai = (status: string, review: string) =>
    `---
id: l1-x
level: 1
module: m
order: 1
title: X
status: ${status}
generated: gemini 2026-10-11
review: ${review}
---
Text.`
  it('cannot be published until reviewed', () => {
    expect(() => parseLesson(ai('published', 'pending'), GLOSSARY)).toThrow(/review: done/)
    expect(parseLesson(ai('published', 'done'), GLOSSARY).status).toBe('published')
    expect(parseLesson(ai('draft', 'pending'), GLOSSARY).status).toBe('draft')
  })
})
