import { Dialog } from '@kobalte/core/dialog'
import { Show } from 'solid-js'
import type { JSX } from 'solid-js'

export function BoardFormDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Optional sr-only line for Dialog.Description (a11y). */
  srOnlyDescription?: string
  backdropBlur?: boolean
  children: JSX.Element
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class={
            props.backdropBlur
              ? 'fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]'
              : 'fixed inset-0 z-40 bg-black/60'
          }
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content class="w-full max-w-2xl rounded-[var(--radius-card)] border border-border bg-bg-elevated p-6 shadow-card">
            <Dialog.Title class="text-lg font-semibold text-fg">{props.title}</Dialog.Title>
            <Show when={props.srOnlyDescription}>
              <Dialog.Description class="sr-only">{props.srOnlyDescription}</Dialog.Description>
            </Show>
            {props.children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  )
}
