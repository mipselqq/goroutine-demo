import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

/** Subpixel / rounding slack vs the clip box (matches hover expand gate). */
export const DESC_PEEK_OVERFLOW_EPS_PX = 1

/** True when collapsed clip content exceeds visible height (needs fade / expand-on-hover). */
export function collapsedDescClipOverflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + DESC_PEEK_OVERFLOW_EPS_PX
}

/**
 * When description is collapsed with max-height, show a bottom fade only if content overflows.
 */
export function createDescPeekNeedsFade(opts: { peek: Accessor<boolean>; refresh: Accessor<unknown> }) {
  const [needsFade, setNeedsFade] = createSignal(false)
  let clipEl: HTMLElement | undefined
  let ro: ResizeObserver | null = null

  const measure = () => {
    const node = clipEl
    if (!node) return
    if (opts.peek()) {
      setNeedsFade(false)
      return
    }
    setNeedsFade(collapsedDescClipOverflows(node))
  }

  const attachClipEl = (el: HTMLElement | undefined) => {
    ro?.disconnect()
    ro = null
    clipEl = el
    if (!clipEl) return
    ro = new ResizeObserver(() => measure())
    ro.observe(clipEl)
    queueMicrotask(measure)
  }

  createEffect(() => {
    opts.refresh()
    opts.peek()
    queueMicrotask(measure)
  })

  onCleanup(() => {
    ro?.disconnect()
    ro = null
    clipEl = undefined
  })

  return [needsFade, attachClipEl] as const
}
