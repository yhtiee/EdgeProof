import { useServerStatus } from '../../lib/api/serverStatus'
import { Banner } from './Banner'

/** Waking and offline states (spec §16, DESIGN.md §2 microcopy). */
export function ServerStatusBanner() {
  const status = useServerStatus()
  if (status === 'online') return null
  if (status === 'waking') {
    return (
      <Banner kind="info" title="Waking up the server">
        This can take up to a minute on our free plan. Your work is saved.
      </Banner>
    )
  }
  return (
    <Banner kind="offline" title="You're offline">
      Lessons still work. New journal entries are saved on this device and sync when you're back.
    </Banner>
  )
}
