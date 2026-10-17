import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { JOURNAL_KEYS } from './api'
import { flushOutbox, useOutbox } from './outbox'

/** Keeps the outbox moving: on load, when the connection returns, and when the tab comes back. */
export function useJournalSync(userId: string | undefined) {
  const queryClient = useQueryClient()
  const outbox = useOutbox(userId)

  const sync = useCallback(async () => {
    if (!userId) return {}
    const result = await flushOutbox(userId)
    if (Object.values(result).includes('synced')) {
      for (const key of JOURNAL_KEYS) void queryClient.invalidateQueries({ queryKey: key })
    }
    return result
  }, [userId, queryClient])

  useEffect(() => {
    if (!userId) return
    void sync()
    const retry = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [userId, sync])

  const items = Object.values(outbox)
  return {
    sync,
    outbox,
    waiting: items.filter((i) => !i.error).length,
    rejected: items.filter((i) => i.error).length,
  }
}
