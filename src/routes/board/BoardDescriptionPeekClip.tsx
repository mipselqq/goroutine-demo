import { createEffect, createMemo, Show } from 'solid-js'
import type { Accessor } from 'solid-js'
import { copy } from '../../lib/copy'
import { BOARD_DESCRIPTION_TEXT_CLASS, BOARD_INLINE_STACK_GAP_CLASS } from '../../lib/boardViewConstants'
import {
  createDescriptionPeek,
  DESCRIPTION_DESC_CLOSE,
  DESCRIPTION_DESC_OPEN,
} from '../../lib/descPeek'
import { collapsedDescClipOverflows, createDescPeekNeedsFade } from '../../lib/descPeekOverflow'

export type BoardDescriptionPeekClipVariant = 'task' | 'column'

export function BoardDescriptionPeekClip(props: {
  variant: BoardDescriptionPeekClipVariant
  refreshKey: Accessor<string>
  hasDescription: Accessor<boolean>
  description: Accessor<string | undefined | null>
  /** Optional: collapse peek while this is true (e.g. this row/column is being dragged). */
  collapsePeekWhen?: Accessor<boolean>
  /** Receive stable `clear()` for grab-handle pointerdown outside this subtree. */
  bindPeekClear?: (clear: () => void) => void
}) {
  let clipEl: HTMLElement | undefined
  const peekCtl = createDescriptionPeek({
    canPeek: () => (clipEl ? collapsedDescClipOverflows(clipEl) : false),
  })
  const [needsFade, attachClip] = createDescPeekNeedsFade({
    peek: peekCtl.peek,
    refresh: () => props.refreshKey(),
  })

  createEffect(() => {
    if (props.collapsePeekWhen?.()) peekCtl.clear()
  })

  createEffect(() => {
    props.bindPeekClear?.(() => peekCtl.clear())
  })

  const clipClass = createMemo(() => {
    const has = props.hasDescription()
    const peek = peekCtl.peek()
    const mt = BOARD_INLINE_STACK_GAP_CLASS
    const outer =
      props.variant === 'task'
        ? 'relative -ml-3 -mr-10 w-[calc(100%+3.25rem)] max-w-none overflow-hidden break-words'
        : `relative w-full max-w-none min-w-0 self-stretch overflow-hidden leading-tight [overflow-wrap:anywhere] ${BOARD_DESCRIPTION_TEXT_CLASS}`

    let mode: string
    if (!has) {
      mode =
        props.variant === 'task'
          ? 'max-h-[2.2rem] min-h-[1.375rem] overflow-hidden'
          : 'max-h-[1.35rem] min-h-[1.05rem] overflow-hidden'
    } else if (peek) {
      mode =
        props.variant === 'task'
          ? 'scrollbar-none max-h-[min(85vh,40rem)] overflow-y-auto'
          : 'scrollbar-none max-h-[min(70vh,28rem)] overflow-y-auto'
    } else {
      mode =
        props.variant === 'task'
          ? 'max-h-[4.4rem] min-h-[2.75rem] overflow-hidden'
          : 'max-h-[2.7rem] min-h-[2.1rem] overflow-hidden'
    }

    return `${outer} ${mt} ${mode}`
  })

  return (
    <div
      ref={(el) => {
        clipEl = el ?? undefined
        attachClip(el ?? undefined)
      }}
      class={clipClass()}
      style={{ transition: peekCtl.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
      onPointerEnter={() => {
        if (!props.hasDescription()) return
        peekCtl.schedule()
      }}
      onPointerLeave={() => {
        if (!props.hasDescription()) return
        peekCtl.clear()
      }}
    >
      <Show
        when={props.hasDescription()}
        fallback={
          <p
            class={`relative z-0 whitespace-pre-wrap px-3 pb-3 leading-tight ${BOARD_DESCRIPTION_TEXT_CLASS} min-h-[1.375rem]`}
          >
            <span class="select-none text-fg/[0.2]">{copy.noDescription}</span>
          </p>
        }
      >
        <>
          <p
            class={`relative z-0 min-w-0 whitespace-pre-wrap break-words px-3 pb-3 leading-tight text-fg-muted ${BOARD_DESCRIPTION_TEXT_CLASS}`}
          >
            {props.description() ?? ''}
          </p>
          <Show when={needsFade()}>
            <div
              class={`peek-desc-fade peek-desc-fade--muted absolute inset-x-0 bottom-0 z-[1] w-full min-w-full ${
                peekCtl.peek() ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ transition: peekCtl.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
              aria-hidden="true"
            />
          </Show>
        </>
      </Show>
    </div>
  )
}
