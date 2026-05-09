import { createEffect, createMemo, type Accessor } from 'solid-js'
import { registerBoardDragGhostEl, setBoardDragGhostScale } from '../../lib/boardDragGhostDom'
import { columnDropIndicatorMetrics } from '../../lib/boardPointerDnD'
import { BOARD_DESCRIPTION_TEXT_CLASS } from '../../lib/boardViewConstants'
import type { AggregateBoardResponse } from '../../lib/api'
import type { BoardDragState } from './boardDragTypes'

export function BoardDragOverlay(props: {
  drag: Accessor<BoardDragState>
  board: Accessor<AggregateBoardResponse | null>
  columnEl: (id: string) => HTMLElement | undefined
  /** Board canvas CSS scale — ghost is `fixed` outside the scaled layer; match visual size + text. */
  boardScale: Accessor<number>
}) {
  createEffect(() => {
    const scRaw = props.boardScale()
    setBoardDragGhostScale(Number.isFinite(scRaw) && scRaw > 0 ? scRaw : 1)
  })

  const overlay = createMemo(() => {
    const d = props.drag()
    const b = props.board()
    if (!d || d.phase !== 'dragging' || !b) return null
    const scRaw = props.boardScale()
    const sc = Number.isFinite(scRaw) && scRaw > 0 ? scRaw : 1
    const inv = 1 / sc
    const ghost = (
      <div
        ref={(node) => registerBoardDragGhostEl(node ?? null)}
        class="pointer-events-none fixed left-0 top-0 z-[90] will-change-transform rounded-[var(--radius-card)] border border-accent/40 bg-bg-elevated/95 p-3 shadow-card"
        style={{
          width: `${d.width * inv}px`,
          'min-height': `${d.height * inv}px`,
          transform: `translate3d(${d.clientX - d.offsetX}px, ${d.clientY - d.offsetY}px, 0) scale(${sc})`,
          'transform-origin': '0 0',
        }}
      >
        <div class={d.kind === 'column' ? 'text-lg font-semibold text-fg' : 'font-medium text-fg'}>{d.title}</div>
        <div class={`mt-1 whitespace-pre-wrap break-words leading-snug text-fg-muted ${BOARD_DESCRIPTION_TEXT_CLASS}`}>{d.sub}</div>
      </div>
    )
    if (d.kind !== 'column') return ghost
    const m = columnDropIndicatorMetrics(d.columnDropSlot, b.columns, (id) => props.columnEl(id))
    return (
      <>
        {ghost}
        {m ? (
          <div
            class="pointer-events-none fixed z-[89] w-0.5 rounded-full bg-accent shadow-[0_0_10px] shadow-accent/60"
            style={{
              left: `${m.x}px`,
              top: `${m.top}px`,
              height: `${m.height}px`,
              transform: 'translateX(-50%)',
            }}
          />
        ) : null}
      </>
    )
  })

  return <>{overlay()}</>
}
