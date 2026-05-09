import { Show, type Accessor } from 'solid-js'
import { copy } from '../../lib/copy'
import type { PopulateStressProgress } from '../../lib/populateStressBoard'

export function BoardPopulateBanner(props: {
  progress: Accessor<PopulateStressProgress | null>
  /** Overrides default populate/import banner title. */
  title?: string
}) {
  return (
    <Show when={() => props.progress()} keyed>
      {(p) => {
        const v = p()
        if (v == null) return null
        return (
          <div class="flex flex-col gap-1.5 border-b border-border bg-bg-muted/35 px-4 py-2.5">
            <div class="flex items-baseline justify-between gap-2 text-xs">
              <span class="font-medium text-fg">{props.title ?? copy.populateCinemaBanner}</span>
              <span class="shrink-0 tabular-nums text-fg-muted">
                {v.done} / {v.total}
              </span>
            </div>
            <p class="truncate text-[11px] leading-tight text-fg-muted">{v.line}</p>
            <div class="h-1 w-full max-w-md overflow-hidden rounded-full bg-bg-muted">
              <div
                class="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${Math.min(100, (v.done / Math.max(1, v.total)) * 100)}%` }}
              />
            </div>
          </div>
        )
      }}
    </Show>
  )
}
