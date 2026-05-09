import { Show } from 'solid-js'
import type { Accessor } from 'solid-js'
import { copy } from '../../lib/copy'
import { BOARD_HEADER_DESCRIPTION_TEXT_CLASS } from '../../lib/boardViewConstants'
import type { AggregateBoardResponse } from '../../lib/api'

export function BoardHeader(props: {
  board: AggregateBoardResponse
  statsLine: Accessor<string | undefined>
}) {
  return (
    <div class="flex min-h-[4rem] min-w-0 flex-1 flex-col justify-center gap-1">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 class="min-w-0 flex-1 truncate text-xl font-semibold leading-tight text-fg">{props.board.name}</h1>
        <span class="shrink-0 rounded-md border border-border/60 bg-bg-muted/40 px-2 py-0.5 text-[11px] font-medium tabular-nums leading-none text-fg-muted">
          {props.statsLine()}
        </span>
      </div>
      <p class={`min-h-[1.58rem] leading-snug ${BOARD_HEADER_DESCRIPTION_TEXT_CLASS}`}>
        <Show
          when={(props.board.description ?? '').trim()}
          fallback={<span class="select-none text-fg/[0.2]">{copy.noDescription}</span>}
        >
          <span class="whitespace-pre-wrap break-words text-fg-muted">{props.board.description}</span>
        </Show>
      </p>
    </div>
  )
}
