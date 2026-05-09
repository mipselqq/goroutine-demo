import type { Accessor } from 'solid-js'
import { BOARD_PAGE_INITIAL_VIEW } from '../../lib/boardViewConstants'
import { SKELETON_FADE_MS } from '../../lib/delayedSkeleton'

const skeletonCols = [0, 1, 2]

/** Mirrors `BoardHeader` layout (title + stats chip + description line). */
export function BoardHeaderSkeleton() {
  return (
    <div class="flex min-h-[4rem] min-w-0 flex-1 flex-col justify-center gap-1">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <div class="h-7 min-h-[1.75rem] min-w-0 flex-1 rounded-md shimmer" />
        <div class="h-5 w-[5.5rem] shrink-0 rounded-md border border-border/40 shimmer" />
      </div>
      <div class="h-[1.58rem] w-full max-w-xl rounded shimmer" />
    </div>
  )
}

export function BoardLoadingSkeleton(props: { visible: Accessor<boolean> }) {
  const { x, y, scale } = BOARD_PAGE_INITIAL_VIEW

  return (
    <div
      class="relative min-h-0 flex-1 touch-none overflow-hidden bg-bg transition-opacity ease-out"
      style={{ 'transition-duration': `${SKELETON_FADE_MS}ms` }}
      classList={{
        'opacity-0': !props.visible(),
        'opacity-100': props.visible(),
      }}
      aria-busy="true"
    >
      <div class="relative z-10 h-full w-full">
        <div
          class="h-full w-full will-change-transform"
          style={{
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
            'transform-origin': '0 0',
            contain: 'layout',
          }}
        >
          <div class="flex h-full min-h-[28rem] flex-row flex-nowrap items-stretch gap-3 p-6 antialiased [text-rendering:geometricPrecision]">
            {skeletonCols.map(() => (
              <div class="flex w-80 shrink-0 flex-col overflow-visible rounded-[var(--radius-card)] border border-border bg-bg-elevated shadow-[0_4px_14px_rgb(0_0_0/0.26)]">
                <div class="flex flex-col gap-1 border-b border-border px-4 py-3">
                  <div class="h-7 w-4/5 rounded shimmer" />
                  <div class="h-3 w-1/3 rounded shimmer" />
                  <div class="mt-2 h-[2.1rem] w-full rounded shimmer" />
                </div>
                <div class="flex min-h-48 flex-1 flex-col gap-2 p-3">
                  <div class="min-h-[4.5rem] w-full rounded-[var(--radius-control)] shimmer" />
                  <div class="min-h-[4.5rem] w-full rounded-[var(--radius-control)] shimmer" />
                </div>
              </div>
            ))}
            <div
              class="flex w-16 shrink-0 flex-col items-center justify-center gap-2 self-stretch rounded-[var(--radius-card)] border border-dashed border-border bg-bg-muted/40"
              aria-hidden="true"
            >
              <div class="size-7 rounded-md shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
