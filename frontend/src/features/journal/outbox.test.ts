import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TradeInput } from './api'

const api = vi.fn()
vi.mock('../../lib/api/client', () => ({
  api: (...args: unknown[]) => api(...args),
  ApiError: class ApiError extends Error {
    status: number
    fields: Record<string, string[]>
    constructor(status: number, body: { message?: string; fields?: Record<string, string[]> } = {}) {
      super(body.message ?? 'api error')
      this.status = status
      this.fields = body.fields ?? {}
    }
  },
}))

const { ApiError } = await import('../../lib/api/client')
const { flushOutbox, queueDelete, queueSave, readOutbox } = await import('./outbox')

const body = (notes = '') => ({ account: 'acc', instrument: 'EUR/USD', side: 'buy', entry: '1.1', notes }) as unknown as TradeInput

describe('journal outbox', () => {
  beforeEach(() => {
    api.mockReset()
    localStorage.clear()
  })

  it('posts a new trade with its client id, then clears it', async () => {
    api.mockResolvedValue({ id: 'srv-1' })
    queueSave('u1', 'c1', body())
    const result = await flushOutbox('u1')
    expect(result.c1).toBe('synced')
    expect(api).toHaveBeenCalledWith('/me/trades', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ client_id: 'c1' }) }))
    expect(readOutbox('u1')).toEqual({})
  })

  it('keeps trades on the device while offline and sends them later, oldest first', async () => {
    api.mockRejectedValue(new Error('offline'))
    queueSave('u2', 'a', body('first'))
    queueSave('u2', 'b', body('second'))
    expect((await flushOutbox('u2')).a).toBe('waiting')
    expect(Object.keys(readOutbox('u2'))).toEqual(['a', 'b'])
    expect(api).toHaveBeenCalledTimes(1) // stopped at the first network failure

    api.mockReset().mockResolvedValue({ id: 'x' })
    await flushOutbox('u2')
    expect(api.mock.calls.map((c) => (c[1] as { body: { notes: string } }).body.notes)).toEqual(['first', 'second'])
    expect(readOutbox('u2')).toEqual({})
  })

  it('keeps a rejected trade with its errors and skips it until edited', async () => {
    api.mockRejectedValue(new ApiError(400, { message: 'Some fields need attention.', fields: { initial_stop: ['Wrong side'] } }))
    queueSave('u3', 'c', body())
    expect((await flushOutbox('u3')).c).toBe('rejected')
    expect(readOutbox('u3').c.error?.fields.initial_stop).toEqual(['Wrong side'])

    api.mockReset()
    await flushOutbox('u3')
    expect(api).not.toHaveBeenCalled()

    api.mockResolvedValue({ id: 'ok' })
    queueSave('u3', 'c', body('fixed')) // editing clears the error
    expect((await flushOutbox('u3')).c).toBe('synced')
  })

  it('patches edits to synced trades and deletes by server id', async () => {
    api.mockResolvedValue({ id: 'srv' })
    queueSave('u4', 'srv', body('edit'), 'srv')
    await flushOutbox('u4')
    expect(api).toHaveBeenCalledWith('/me/trades/srv', expect.objectContaining({ method: 'PATCH' }))
    queueDelete('u4', 'srv', 'srv')
    await flushOutbox('u4')
    expect(api).toHaveBeenLastCalledWith('/me/trades/srv', expect.objectContaining({ method: 'DELETE' }))
  })

  it('forgets a trade deleted before it ever reached the server', async () => {
    queueSave('u5', 'local', body())
    queueDelete('u5', 'local')
    await flushOutbox('u5')
    expect(api).not.toHaveBeenCalled()
    expect(readOutbox('u5')).toEqual({})
  })
})
