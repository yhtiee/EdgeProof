import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SafeMarkdown } from './SafeMarkdown'

describe('SafeMarkdown (AI output)', () => {
  it('renders the supported subset', () => {
    const { container } = render(<SafeMarkdown text={'A **pip** is *small*.\n\n- one\n- two\n\n1. first\n2. second\n\nUse `0.0001`.'} />)
    expect(container.querySelector('strong')?.textContent).toBe('pip')
    expect(container.querySelector('em')?.textContent).toBe('small')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelector('code')?.textContent).toBe('0.0001')
  })

  it('never turns model output into HTML', () => {
    const evil = '<img src=x onerror="alert(1)"> <script>alert(2)</script> [link](javascript:alert(3)) <a href="https://x">x</a>'
    const { container } = render(<SafeMarkdown text={evil} />)
    expect(container.querySelector('img, script, a, iframe')).toBeNull()
    expect(container.textContent).toContain('<img src=x')
  })
})
