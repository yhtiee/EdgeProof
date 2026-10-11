import { useQuery } from '@tanstack/react-query'

/**
 * Lesson content types and loaders. Content is static JSON compiled from the
 * Markdown in content/ (scripts/compile-lessons.mjs), served by Vercel and
 * cached by the service worker, so it loads while the API sleeps (spec §13).
 */

export type Inline =
  | { t: 'text' | 'strong'; v: string }
  | { t: 'link'; href: string; v: string }
  | { t: 'term'; term: string; v: string }
  | { t: 'cite'; id: string }

/** An entry from content/sources.json, resolved at build time. */
export type Source = {
  id: string
  kind: 'book' | 'paper' | 'report' | 'web'
  author: string
  title: string
  year: number | null
  access: 'free' | 'paid'
  url: string
  about: string
  facts?: string[]
}

export type TextContent = { type: 'p'; inline: Inline[] } | { type: 'ul'; items: Inline[][] }

export type QuestionBlock = { type: 'question'; prompt: Inline[]; explanation: Inline[] } & (
  | { kind: 'mc'; options: { key: string; inline: Inline[] }[]; answer: string }
  | { kind: 'numeric'; answer: number; tolerance: number; unit: string }
)

export type Block =
  | { type: 'text'; content: TextContent[] }
  | { type: 'takeaway'; content: TextContent[] }
  | { type: 'simulator'; kind: string }
  | { type: 'diagram'; src: string; alt: string }
  | { type: 'quote'; text: string; source: string; page?: string }
  | QuestionBlock

export type Screen = { blocks: Block[] }

export type Lesson = {
  slug: string
  level: number
  module: string
  order: number
  title: string
  status: 'draft' | 'published'
  minutes: number
  questions: number
  sources: Source[]
  screens: Screen[]
}

export type LessonSummary = Pick<Lesson, 'slug' | 'title' | 'order' | 'minutes' | 'status' | 'questions'> & {
  screens: number
}

export type CurriculumModule = { order: number; slug: string; title: string; lessons: LessonSummary[] }

export type CurriculumLevel = {
  order: number
  slug: string
  title: string
  phase: number
  reading: Source[]
  reading_note?: string
  modules: CurriculumModule[]
}

export type Curriculum = { levels: CurriculumLevel[] }

export type GlossaryEntry = { term: string; definition: string }

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(res.status === 404 ? 'This lesson isn’t published yet.' : `Couldn’t load ${path}.`)
  return res.json() as Promise<T>
}

export const useCurriculum = () =>
  useQuery({ queryKey: ['curriculum'], queryFn: () => getJson<Curriculum>('/lessons/index.json'), staleTime: Infinity })

export const useLesson = (slug: string | undefined) =>
  useQuery({
    queryKey: ['lesson', slug],
    queryFn: () => getJson<Lesson>(`/lessons/${slug}.json`),
    enabled: !!slug,
    staleTime: Infinity,
  })

export const useGlossary = () =>
  useQuery({
    queryKey: ['glossary'],
    queryFn: () => getJson<Record<string, GlossaryEntry>>('/lessons/glossary.json'),
    staleTime: Infinity,
  })

/** Published lessons in curriculum order, with their place in it. */
export type LessonRef = LessonSummary & { level: CurriculumLevel; module: CurriculumModule }

export function lessonsInOrder(c: Curriculum): LessonRef[] {
  return c.levels.flatMap((level) =>
    level.modules.flatMap((module) => module.lessons.map((lesson) => ({ ...lesson, level, module }))),
  )
}
