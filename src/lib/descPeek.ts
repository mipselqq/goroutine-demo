import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

export const DESCRIPTION_PEEK_DELAY_MS = 220

/** Max-height + opacity on description clip / fade overlay. */
export const DESCRIPTION_DESC_OPEN =
  'max-height 520ms cubic-bezier(0.4, 0, 0.2, 1), opacity 380ms cubic-bezier(0.4, 0, 0.2, 1)'
export const DESCRIPTION_DESC_CLOSE =
  'max-height 320ms cubic-bezier(0.4, 0, 1, 1), opacity 240ms cubic-bezier(0.4, 0, 1, 1)'

type PeekOpts = {
  /** Clear expanded state when this signal changes (e.g. board drag generation). */
  resetOn?: Accessor<unknown>
  delayMs?: number
  /** If set and returns false, hover does not run expand (e.g. text fits in collapsed clip). */
  canPeek?: () => boolean
}

export function createDescriptionPeek(opts?: PeekOpts) {
  const delay = opts?.delayMs ?? DESCRIPTION_PEEK_DELAY_MS
  const [peek, setPeek] = createSignal(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  const clear = () => {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
    setPeek(false)
  }
  const schedule = () => {
    if (opts?.canPeek && !opts.canPeek()) return
    clear()
    timer = window.setTimeout(() => {
      timer = null
      setPeek(true)
    }, delay)
  }
  if (opts?.resetOn) {
    createEffect(() => {
      opts.resetOn!()
      clear()
    })
  }
  onCleanup(clear)
  return { peek, schedule, clear } as const
}
