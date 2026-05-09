import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

/** Subpixel / rounding slack vs the clip box (matches hover expand gate). */
export const DESC_PEEK_OVERFLOW_EPS_PX = 3

function primaryDescContentChild(el: HTMLElement): HTMLElement | null {
  const kids = Array.from(el.children)
  for (const child of kids) {
    if (!(child instanceof HTMLElement)) continue
    if (child.getAttribute('aria-hidden') === 'true') continue
    return child
  }
  return null
}

/**
 * True when collapsed clip content exceeds visible height (needs fade / expand-on-hover).
 * Prefer layout boxes on the first non-decoration child: `scrollHeight` can mis-report when the
 * clip uses flex/min-height, or when padding on inner `<p>` inflates scroll extents while text fits.
 */
export function collapsedDescClipOverflows(el: HTMLElement): boolean {
  const eps = DESC_PEEK_OVERFLOW_EPS_PX
  const content = primaryDescContentChild(el)
  if (content) {
    const clipH = el.getBoundingClientRect().height
    const contentH = content.getBoundingClientRect().height
    if (contentH <= clipH + eps) return false
    if (contentH > clipH + eps) return true
  }
  return el.scrollHeight > el.clientHeight + eps
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
