import { TextField } from '@kobalte/core/text-field'
import type { Accessor } from 'solid-js'
import { createEffect } from 'solid-js'
import { fitTextareaHeight } from '../../lib/fitTextareaHeight'

export const DESCRIPTION_TEXTAREA_CLASS =
  'kb-focus-ring box-border min-h-0 resize-none rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm leading-normal text-fg'

export function DescriptionField(props: {
  label: string
  value: Accessor<string>
  onInput: (v: string) => void
  maxLength: number
  placeholder?: string
  ref: (el: HTMLTextAreaElement | undefined) => void
  onKeyDown?: (e: KeyboardEvent) => void
}) {
  let el: HTMLTextAreaElement | undefined

  const scheduleFit = () => {
    requestAnimationFrame(() => {
      if (el) fitTextareaHeight(el)
    })
  }

  createEffect(() => {
    props.value()
    scheduleFit()
  })

  return (
    <TextField class="flex flex-col gap-1">
      <TextField.Label class="text-sm font-medium">{props.label}</TextField.Label>
      <TextField.TextArea
        ref={(r) => {
          el = r ?? undefined
          props.ref(r ?? undefined)
          scheduleFit()
        }}
        class={DESCRIPTION_TEXTAREA_CLASS}
        rows={1}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        value={props.value()}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={props.onKeyDown}
      />
    </TextField>
  )
}
