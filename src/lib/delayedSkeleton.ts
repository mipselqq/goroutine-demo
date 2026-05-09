import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

/** Wait before showing skeletons so fast loads do not flash. */
export const SKELETON_SHOW_DELAY_MS = 200

/** Opacity ramp once skeletons become visible. */
export const SKELETON_FADE_MS = 200

/**
 * While `active` stays true for {@link SKELETON_SHOW_DELAY_MS}, sets the returned
 * signal to true. When `active` is false, clears immediately (no delay on hide).
 */
export function createDelayedSkeletonShow(active: Accessor<boolean>): Accessor<boolean> {
  const [show, setShow] = createSignal(false)

  createEffect(() => {
    const on = active()
    if (!on) {
      setShow(false)
      return
    }
    const id = window.setTimeout(() => {
      if (active()) setShow(true)
    }, SKELETON_SHOW_DELAY_MS)
    onCleanup(() => window.clearTimeout(id))
  })

  return show
}
