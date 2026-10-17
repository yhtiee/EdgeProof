import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

/**
 * Bottom sheet (DESIGN.md §7): the mobile replacement for modals and long
 * option lists; on wider screens it opens as a side sheet. Radix Dialog
 * handles focus trapping, Esc and returning focus.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-text/40" />
        <Dialog.Content
          className="ep-slide-up fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-lg border border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-sheet outline-none md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[480px] md:rounded-none md:border-y-0 md:border-r-0"
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-h3">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-small text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-small font-semibold text-muted hover:bg-raised hover:text-text">
              <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Close
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
          {footer && <div className="border-t border-border px-4 py-3 md:px-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
