import type { ReactNode } from 'react'

/**
 * A small Markdown subset for AI output (spec §10: "sanitised markdown with
 * no raw HTML"): paragraphs, bulleted and numbered lists, **bold**, *italic*
 * and `code`. Everything is built as React elements from plain text, so no
 * HTML from the model can ever reach the page.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const token = m[0]
    const key = `${keyBase}-${i++}`
    if (token.startsWith('**')) out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith('`')) out.push(<code key={key} className="rounded-sm bg-raised px-1 font-mono text-[0.9em]">{token.slice(1, -1)}</code>)
    else out.push(<em key={key}>{token.slice(1, -1)}</em>)
    last = m.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function SafeMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')
  let i = 0
  let b = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    // Blank lines and horizontal rules separate blocks.
    if (!line || /^-{3,}$/.test(line)) {
      i++
      continue
    }
    const bullet = /^[-*•]\s+/
    const numbered = /^\d+[.)]\s+/
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line)
      const items: string[] = []
      while (i < lines.length && (ordered ? numbered : bullet).test(lines[i].trim())) {
        items.push(lines[i].trim().replace(ordered ? numbered : bullet, ''))
        i++
      }
      const List = ordered ? 'ol' : 'ul'
      blocks.push(
        <List key={b++} className={`grid gap-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `l${b}-${j}`)}</li>
          ))}
        </List>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !bullet.test(lines[i].trim()) && !numbered.test(lines[i].trim())) {
      para.push(lines[i].trim().replace(/^#{1,6}\s+/, ''))
      i++
    }
    blocks.push(<p key={b++}>{inline(para.join(' '), `p${b}`)}</p>)
  }
  return <div className={`grid gap-3 ${className}`}>{blocks}</div>
}
