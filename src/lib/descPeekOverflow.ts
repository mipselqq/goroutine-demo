import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

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
    setNeedsFade(node.scrollHeight > node.clientHeight + 1)
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
