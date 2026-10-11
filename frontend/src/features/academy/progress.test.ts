import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.fn()
vi.mock('../../lib/api/client', () => ({
  api: (...args: unknown[]) => api(...args),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number) {
      super('api error')
      this.status = status
    }
  },
}))

const { flushProgress, recordScreen } = await import('./progress')
const stored = (user: string) => JSON.parse(localStorage.getItem(`edgeproof.progress.${user}`) ?? '{}')

describe('lesson progress sync', () => {
  beforeEach(() => {
    api.mockReset()
    localStorage.clear()
  })

  it('still syncs after a flush with nothing to send (regression: stuck in-flight marker)', async () => {
    await flushProgress('u1') // empty store: the body finishes synchronously
    api.mockResolvedValue({})
    recordScreen('u1', 'lesson-a', 0, 3)
    await vi.waitFor(() => expect(stored('u1')['lesson-a'].pending).toBe(false))
    expect(api).toHaveBeenCalledWith('/lessons/lesson-a/progress', expect.objectContaining({ body: { completed_blocks: [0] } }))
  })

  it('keeps progress pending when offline and sends everything on the next flush', async () => {
    api.mockRejectedValue(new Error('offline'))
    recordScreen('u2', 'lesson-a', 0, 3)
    recordScreen('u2', 'lesson-a', 1, 3)
    await vi.waitFor(() => expect(api).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(stored('u2')['lesson-a']).toMatchObject({ screens: [0, 1], pending: true })

    api.mockReset().mockResolvedValue({})
    await flushProgress('u2')
    await vi.waitFor(() => expect(stored('u2')['lesson-a'].pending).toBe(false))
    expect(api).toHaveBeenLastCalledWith(
      '/lessons/lesson-a/progress',
      expect.objectContaining({ body: { completed_blocks: [0, 1] } }),
    )
  })
})
