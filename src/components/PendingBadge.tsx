import { copy } from '../lib/copy'
import { pendingCount } from '../lib/pending'

export function PendingBadge() {
  const awaiting = () => pendingCount() > 0
  return (
    <div
      class="pointer-events-none fixed bottom-4 right-4 z-50 w-max max-w-[min(90vw,13rem)] rounded-[var(--radius-control)] border bg-bg-elevated/95 px-2 py-1.5 text-[11px] leading-snug shadow-card backdrop-blur-sm transform-gpu transition-[border-color,box-shadow,color,background-color] duration-[550ms] ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
      classList={{
        'border-emerald-500/45 text-emerald-100/[0.92] shadow-[0_0_22px_rgba(34,197,94,0.14)] [background-color:color-mix(in_oklab,var(--color-bg-elevated)_92%,rgb(34_197_94)_8%)]':
          !awaiting(),
        'border-red-400/50 text-red-100/[0.92] shadow-[0_0_22px_rgba(248,113,113,0.16)] [background-color:color-mix(in_oklab,var(--color-bg-elevated)_90%,rgb(248_113_113)_10%)]':
          awaiting(),
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={awaiting()}
    >
      <span class="flex items-center gap-1.5">
        <span
          class="sync-status-dot size-1.5 shrink-0 rounded-full motion-reduce:transition-none"
          classList={{
            'sync-dot--synced': !awaiting(),
            'sync-dot--pending': awaiting(),
          }}
          aria-hidden="true"
        />
        <span class="relative grid min-h-[1.2em] w-max min-w-0 place-items-start whitespace-nowrap">
          <span
            class="col-start-1 row-start-1 transition-opacity duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
            classList={{
              'z-[1] opacity-100': !awaiting(),
              'z-0 opacity-0': awaiting(),
            }}
          >
            {copy.serverStateSynced}
          </span>
          <span
            class="col-start-1 row-start-1 transition-opacity duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
            classList={{
              'z-0 opacity-0': !awaiting(),
              'z-[1] opacity-100': awaiting(),
            }}
          >
            {copy.serverStatePending}
          </span>
        </span>
      </span>
    </div>
  )
}
