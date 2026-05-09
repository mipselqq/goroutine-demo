import { TextField } from '@kobalte/core/text-field'
import type { Accessor } from 'solid-js'
import { createEffect, Show } from 'solid-js'
import { fitTextareaHeight } from '../../lib/fitTextareaHeight'

export const DESCRIPTION_TEXTAREA_CLASS =
  'kb-focus-ring box-border min-h-0 max-h-[min(75svh,33rem)] resize-none overflow-x-hidden rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm leading-normal text-fg'

export function DescriptionField(props: {
  label: string
  value: Accessor<string>
  onInput: (v: string) => void
  /** Omit or pass `undefined` to disable HTML max length (e.g. client-validation bypass). */
  maxLength?: number
  /** Show “12/1024” next to the label when set (e.g. name 128, description 1024). */
  charCountMax?: number
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
      <TextField.Label class="block w-full text-sm font-medium">
        <Show
          when={props.charCountMax !== undefined}
          fallback={<span>{props.label}</span>}
        >
          <div class="flex w-full min-w-0 items-center justify-between gap-2">
            <span class="min-w-0">{props.label}</span>
            <span
              class="shrink-0 tabular-nums text-xs"
              classList={{
                'text-danger': props.charCountMax !== undefined && props.value().length > props.charCountMax,
                'text-fg-muted': props.charCountMax === undefined || props.value().length <= props.charCountMax,
              }}
            >
              {props.value().length}/{props.charCountMax}
            </span>
          </div>
        </Show>
      </TextField.Label>
      <TextField.TextArea
        ref={(r) => {
          el = r ?? undefined
          props.ref(r ?? undefined)
          scheduleFit()
        }}
        class={DESCRIPTION_TEXTAREA_CLASS}
        rows={1}
        {...(props.maxLength !== undefined ? { maxLength: props.maxLength } : {})}
        placeholder={props.placeholder}
        value={props.value()}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={props.onKeyDown}
      />
    </TextField>
  )
}
