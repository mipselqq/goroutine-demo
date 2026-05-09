import { Dialog, useDialogContext } from '@kobalte/core/dialog'
import type { JSX } from 'solid-js'
import { shellBypassExcludeEl } from '../../lib/shellBypassExclude'

/** Dialog.Content with shell bypass strip excluded from outside-dismiss (see AppShell portal). */
export function ShellExcludedDialogContent(props: {
  class?: string
  ref?: (el: HTMLElement | undefined) => void
  tabIndex?: number
  onOpenAutoFocus?: (e: Event) => void
  onKeyDown?: (e: KeyboardEvent) => void
  children: JSX.Element
}) {
  const ctx = useDialogContext()
  return (
    <Dialog.Content
      ref={props.ref}
      excludedElements={[ctx.triggerRef, shellBypassExcludeEl]}
      class={props.class}
      tabIndex={props.tabIndex}
      onOpenAutoFocus={props.onOpenAutoFocus}
      onKeyDown={props.onKeyDown}
    >
      {props.children}
    </Dialog.Content>
  )
}
