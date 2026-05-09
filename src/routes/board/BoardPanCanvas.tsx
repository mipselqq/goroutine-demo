import { For, createRenderEffect, createSignal, onCleanup } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import { copy } from '../../lib/copy'
import type { AggregateBoardResponse } from '../../lib/api'
import type { BoardPanView } from '../../lib/boardPanView'
import type { BoardDragPayload, BoardDragState } from './boardDragTypes'
import { snapPanZoomForPaint } from '../../lib/boardTransformSnap'
import { AddColumnZone } from './AddColumnZone'
import { BoardDragOverlay } from './BoardDragOverlay'
import { ColumnCard } from './ColumnCard'

export type { BoardPanView } from '../../lib/boardPanView'

export type BoardPanCanvasProps = {
  boardId: string
  board: AggregateBoardResponse
  view: BoardPanView
  setView: SetStoreFunction<BoardPanView>
  pan: () => { sx: number; sy: number; vx: number; vy: number } | null
  setPan: (v: { sx: number; sy: number; vx: number; vy: number } | null) => void
  beginPan: (clientX: number, clientY: number) => void
  onWheelCanvas: (e: WheelEvent) => void
  setBoard: (fn: (b: AggregateBoardResponse) => void) => void
  setColumnEl: (columnId: string, el: HTMLElement | undefined) => void
  setTaskAreaEl: (columnId: string, el: HTMLElement | undefined) => void
  boardDrag: () => BoardDragState
  startBoardDrag: (e: PointerEvent, payload: BoardDragPayload) => void
  onBoardError: (err?: unknown) => void
  columnElLookup: (id: string) => HTMLElement | undefined
  onViewportRef?: (el: HTMLElement | undefined) => void
}

export function BoardPanCanvas(props: BoardPanCanvasProps) {
  /** Only one task edit dialog open board-wide (avoids stacked modals after API error reopen). */
  const [exclusiveEditTaskId, setExclusiveEditTaskId] = createSignal<string | null>(null)

  /** Coalesce pointermove pan to one store write per animation frame (fewer reactive runs). */
  let panMoveRaf = 0
  let pendingPan: { x: number; y: number } | null = null

  const flushPanPending = () => {
    panMoveRaf = 0
    const q = pendingPan
    pendingPan = null
    if (q) props.setView({ x: q.x, y: q.y })
  }

  const cancelPanMoveSchedule = () => {
    if (panMoveRaf !== 0) {
      cancelAnimationFrame(panMoveRaf)
      panMoveRaf = 0
    }
    pendingPan = null
  }

  const flushPanPendingSync = () => {
    if (panMoveRaf !== 0) {
      cancelAnimationFrame(panMoveRaf)
      panMoveRaf = 0
    }
    const q = pendingPan
    pendingPan = null
    if (q) props.setView({ x: q.x, y: q.y })
  }

  const [panLayerEl, setPanLayerEl] = createSignal<HTMLDivElement | undefined>()

  /** Same-frame DOM sync before paint (smoother high-refresh pan/zoom than deferred createEffect). */
  createRenderEffect(() => {
    const el = panLayerEl()
    if (!el) return
    const { x, y, scale } = snapPanZoomForPaint(props.view.x, props.view.y, props.view.scale)
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  })

  onCleanup(() => {
    cancelPanMoveSchedule()
  })

  return (
    <div
      class="relative min-h-0 flex-1 touch-none overflow-hidden bg-bg"
      ref={(el) => {
        props.onViewportRef?.(el ?? undefined)
        if (!el) return
        el.addEventListener('wheel', props.onWheelCanvas, { passive: false })
        const cap = (e: PointerEvent) => {
          if (e.button !== 0 || !e.ctrlKey) return
          e.preventDefault()
          e.stopPropagation()
          el.setPointerCapture(e.pointerId)
          props.beginPan(e.clientX, e.clientY)
        }
        const move = (e: PointerEvent) => {
          const p = props.pan()
          if (!p) return
          pendingPan = {
            x: p.vx + (e.clientX - p.sx),
            y: p.vy + (e.clientY - p.sy),
          }
          if (panMoveRaf === 0) {
            panMoveRaf = requestAnimationFrame(flushPanPending)
          }
        }
        const up = (e: PointerEvent) => {
          if (!props.pan()) return
          flushPanPendingSync()
          try {
            el.releasePointerCapture(e.pointerId)
          } catch {
            /* ignore */
          }
          props.setPan(null)
        }
        const cancel = () => {
          flushPanPendingSync()
          props.setPan(null)
        }
        el.addEventListener('pointerdown', cap, true)
        el.addEventListener('pointermove', move)
        el.addEventListener('pointerup', up)
        el.addEventListener('pointercancel', cancel)
        onCleanup(() => {
          flushPanPendingSync()
          el.removeEventListener('wheel', props.onWheelCanvas)
          el.removeEventListener('pointerdown', cap, true)
          el.removeEventListener('pointermove', move)
          el.removeEventListener('pointerup', up)
          el.removeEventListener('pointercancel', cancel)
        })
      }}
    >
      <div
        class="absolute inset-0 z-0 bg-transparent"
        data-pan-surface=""
        onPointerDown={(e) => {
          if (e.button !== 0 || e.ctrlKey) return
          if ((e.target as HTMLElement).closest('[data-board-interactive]')) return
          const parent = e.currentTarget.parentElement as HTMLElement
          parent.setPointerCapture(e.pointerId)
          props.beginPan(e.clientX, e.clientY)
        }}
      />
      <div class="relative z-10 h-full w-full">
        <div
          ref={(el) => setPanLayerEl(el ?? undefined)}
          class="h-full w-full will-change-transform"
          style={{
            'transform-origin': '0 0',
            /** layout only — `paint` caused clipped/missing paint after zoom when columns were initially off-screen */
            contain: 'layout',
          }}
        >
          <div class="flex h-full min-h-[28rem] flex-row flex-nowrap items-stretch gap-3 p-6 antialiased [text-rendering:geometricPrecision]">
            <For each={props.board.columns}>
              {(col) => (
                <ColumnCard
                  boardId={props.boardId}
                  column={col}
                  setBoard={props.setBoard}
                  setColumnEl={props.setColumnEl}
                  setTaskAreaEl={props.setTaskAreaEl}
                  boardDrag={props.boardDrag}
                  startBoardDrag={props.startBoardDrag}
                  onBoardError={props.onBoardError}
                  exclusiveEditTaskId={exclusiveEditTaskId}
                  setExclusiveEditTaskId={setExclusiveEditTaskId}
                />
              )}
            </For>
            <AddColumnZone boardId={props.boardId} setBoard={props.setBoard} />
          </div>
        </div>
        <BoardDragOverlay
          drag={props.boardDrag}
          board={() => props.board}
          columnEl={props.columnElLookup}
          boardScale={() => props.view.scale}
        />
      </div>
      <p class="pointer-events-none absolute bottom-2 left-4 z-20 max-w-xl text-xs text-fg-muted">
        {copy.boardDetailPanHint}
      </p>
    </div>
  )
}
