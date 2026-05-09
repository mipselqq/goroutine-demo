import { batch, createEffect, createMemo, createResource, createSignal, onCleanup, Show, untrack } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { useLocation, useNavigate, useParams } from '@solidjs/router'
import { copy, formatBoardCompactStats } from '../lib/copy'
import { setCachedBoardCounts } from '../lib/boardCountCache'
import {
  ApiError,
  getBoardAggregate,
  moveColumn,
  moveTask,
  POSITION_BASE,
  sortAggregate,
  type AggregateBoardResponse,
} from '../lib/api'
import { cloneBoard, cloneBoardShallowColumns } from '../lib/optimistic'
import { createDelayedSkeletonShow, SKELETON_FADE_MS } from '../lib/delayedSkeleton'
import {
  columnReorderSlot,
  sameTaskLayout,
  taskColumnIdFromPoint,
  taskDropIfMoves,
  taskInsertIndexFromPointIgnoring,
} from '../lib/boardPointerDnD'
import { columnReorderIsNoop, moveTaskTo } from '../lib/boardLayout'
import { attachBoardDragPointerSession } from '../lib/boardDragSession'
import { createBoardFollowScheduler } from '../lib/boardFollowSchedule'
import { useBoardKeyboardPan } from '../lib/useBoardKeyboardPan'
import { useBoardPopulateCinema } from '../lib/useBoardPopulateCinema'
import {
  BOARD_PAGE_INITIAL_VIEW,
  BOARD_WHEEL_FINAL_SLOW_DISTANCE,
  BOARD_WHEEL_FINAL_SLOW_FACTOR,
  BOARD_WHEEL_SMOOTH_ALPHA,
} from '../lib/boardViewConstants'
import { isFineWheel, wheelCoarseTargetScale, wheelFineTargetScale } from '../lib/boardWheelZoom'
import type { BoardDragPayload, BoardDragState, TaskDropPreview } from './board/boardDragTypes'
import { BoardHeader } from './board/BoardHeader'
import { BoardHeaderSkeleton, BoardLoadingSkeleton } from './board/BoardLoadingSkeleton'
import { BoardPanCanvas } from './board/BoardPanCanvas'
import { BoardPopulateBanner } from './board/BoardPopulateBanner'

export default function BoardPage() {
  const params = useParams<{ boardId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [store, setStore] = createStore<{
    board: AggregateBoardResponse | null
    loadError: string | null
  }>({ board: null, loadError: null })

  const [agg] = createResource(
    () => params.boardId,
    async (id) => {
      const { data } = await getBoardAggregate(id)
      return sortAggregate(data)
    },
  )

  createEffect(() => {
    const v = agg()
    if (v) {
      setStore('board', v)
      setStore('loadError', null)
    }
  })

  createEffect(() => {
    const err = agg.error
    if (!err) return
    if (err instanceof ApiError && err.status === 401) {
      navigate('/login', { replace: true })
      return
    }
    setStore('loadError', err instanceof ApiError ? err.message : copy.somethingWrong)
  })

  const [view, setView] = createStore({ ...BOARD_PAGE_INITIAL_VIEW })
  const [pan, setPan] = createSignal<{
    sx: number
    sy: number
    vx: number
    vy: number
  } | null>(null)

  let zoomRaf = 0
  let wheelAnchor: {
    mx: number
    my: number
    wx: number
    wy: number
    s1: number
  } | null = null

  const cancelWheelZoom = () => {
    if (zoomRaf !== 0) {
      cancelAnimationFrame(zoomRaf)
      zoomRaf = 0
    }
    wheelAnchor = null
  }

  onCleanup(cancelWheelZoom)

  const columnEls = new Map<string, HTMLElement>()
  const taskAreaEls = new Map<string, HTMLElement>()

  const follow = createBoardFollowScheduler({
    getColumnEl: (id) => columnEls.get(id),
    setView,
  })

  const populateLive = useBoardPopulateCinema({
    getSearch: () => location.search,
    getBoardId: () => params.boardId,
    getBoard: () => store.board,
    navigate,
    setStore,
    setView,
    scheduleFollow: follow.scheduleEntity,
  })

  useBoardKeyboardPan({
    getBoard: () => store.board,
    setView,
  })

  const boardMeta = createMemo(() => {
    const b = store.board
    if (!b) return null
    const tasks = b.columns.reduce((n, c) => n + c.tasks.length, 0)
    return {
      id: b.id,
      cols: b.columns.length,
      tasks,
      stats: formatBoardCompactStats(b.columns.length, tasks),
    }
  })

  createEffect(() => {
    const m = boardMeta()
    if (m) setCachedBoardCounts(m.id, m.cols, m.tasks)
  })

  const statsLine = () => boardMeta()?.stats

  const setColumnEl = (columnId: string, el: HTMLElement | undefined) => {
    if (el) columnEls.set(columnId, el)
    else columnEls.delete(columnId)
  }

  const setTaskAreaEl = (columnId: string, el: HTMLElement | undefined) => {
    if (el) taskAreaEls.set(columnId, el)
    else taskAreaEls.delete(columnId)
  }

  const columnSlotAtClientX = (clientX: number) => {
    const b = store.board
    if (!b) return 0
    return columnReorderSlot(clientX, b.columns, (id) => columnEls.get(id))
  }

  const taskDropAtPoint = (
    clientX: number,
    clientY: number,
    draggingTaskId: string,
  ): TaskDropPreview | null => {
    const b = store.board
    if (!b) return null
    const targetColumnId = taskColumnIdFromPoint(
      b.columns,
      clientX,
      clientY,
      (id) => taskAreaEls.get(id),
      (id) => columnEls.get(id),
    )
    if (!targetColumnId) return null
    const area = taskAreaEls.get(targetColumnId)
    if (!area) return null
    return {
      columnId: targetColumnId,
      insertIndex: taskInsertIndexFromPointIgnoring(area, clientY, draggingTaskId),
    }
  }

  const taskDropActiveAtPoint = (
    clientX: number,
    clientY: number,
    sourceColumnId: string,
    taskId: string,
  ): TaskDropPreview | null => {
    const b = store.board
    if (!b) return null
    return taskDropIfMoves(b, sourceColumnId, taskId, taskDropAtPoint(clientX, clientY, taskId))
  }

  const [boardDrag, setBoardDrag] = createSignal<BoardDragState>(null)

  const commitColumnToSlot = (columnId: string, slot: number) => {
    const b = store.board
    if (!b) return
    if (columnReorderIsNoop(b.columns, columnId, slot)) return

    const snap = cloneBoardShallowColumns(b)

    batch(() => {
      setStore(
        'board',
        produce((draft) => {
          if (!draft) return
          const cols = draft.columns
          const fromIdx = cols.findIndex((c) => c.id === columnId)
          if (fromIdx === -1) return
          let ins = slot
          if (fromIdx < ins) ins -= 1
          const [moved] = cols.splice(fromIdx, 1)
          cols.splice(ins, 0, moved)
          cols.forEach((c, i) => {
            c.position = i + POSITION_BASE
          })
        }),
      )
    })

    const newIndex = store.board!.columns.findIndex((c) => c.id === columnId)
    const tp = newIndex + POSITION_BASE
    queueMicrotask(() => {
      void moveColumn(params.boardId, columnId, { targetPosition: tp }).catch(() => {
        setStore('board', snap)
        setStore('loadError', copy.somethingWrong)
      })
    })
  }

  const commitTaskToSlot = (
    taskId: string,
    fromColumnId: string,
    targetColumnId: string,
    insertIndex: number,
  ) => {
    const b = store.board
    if (!b) return
    const snap = cloneBoard(b)
    const next = moveTaskTo(b, taskId, targetColumnId, insertIndex)
    if (sameTaskLayout(next, b)) return
    setStore('board', next)
    void moveTask(params.boardId, fromColumnId, taskId, {
      targetColumnId,
      targetPosition: insertIndex + POSITION_BASE,
    }).catch(() => {
      setStore('board', snap)
      setStore('loadError', copy.somethingWrong)
    })
  }

  const startBoardDrag = (e: PointerEvent, payload: BoardDragPayload) => {
    attachBoardDragPointerSession(e, payload, {
      getBoard: () => store.board,
      boardId: params.boardId,
      getBoardDrag: boardDrag,
      setBoardDrag,
      getColumnEl: (id) => columnEls.get(id),
      columnSlotAtClientX,
      taskDropActiveAtPoint,
      commitColumnToSlot,
      commitTaskToSlot,
    })
  }

  const onWheelCanvas = (e: WheelEvent) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top

    const vs = view.scale
    const vx = view.x
    const vy = view.y
    const wx = (mx - vx) / vs
    const wy = (my - vy) / vs

    const s1 = isFineWheel(e) ? wheelFineTargetScale(vs, e) : wheelCoarseTargetScale(vs, e)
    if (Math.abs(s1 - vs) < 1e-7) return

    wheelAnchor = { mx, my, wx, wy, s1 }

    const SNAP = 6e-5
    const step = () => {
      zoomRaf = 0
      const a = wheelAnchor
      if (!a) return

      const cur = untrack(() => view.scale)
      const delta = a.s1 - cur
      if (Math.abs(delta) < SNAP) {
        batch(() =>
          setView({
            scale: a.s1,
            x: a.mx - a.wx * a.s1,
            y: a.my - a.wy * a.s1,
          }),
        )
        wheelAnchor = null
        return
      }

      const nextS =
        cur +
        delta *
          (Math.abs(delta) < BOARD_WHEEL_FINAL_SLOW_DISTANCE
            ? BOARD_WHEEL_SMOOTH_ALPHA * BOARD_WHEEL_FINAL_SLOW_FACTOR
            : BOARD_WHEEL_SMOOTH_ALPHA)
      batch(() =>
        setView({
          scale: nextS,
          x: a.mx - a.wx * nextS,
          y: a.my - a.wy * nextS,
        }),
      )
      zoomRaf = requestAnimationFrame(step)
    }

    if (zoomRaf === 0) {
      zoomRaf = requestAnimationFrame(step)
    }
  }

  const beginPan = (clientX: number, clientY: number) => {
    setPan({
      sx: clientX,
      sy: clientY,
      vx: view.x,
      vy: view.y,
    })
  }

  const setBoard = (fn: (b: AggregateBoardResponse) => void) => {
    setStore(
      'board',
      produce((draft) => {
        if (!draft) return
        fn(draft as AggregateBoardResponse)
      }),
    )
  }

  const boardSkeletonActive = () => agg.loading && !store.board
  const boardSkeletonVisible = createDelayedSkeletonShow(boardSkeletonActive)

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center gap-3 border-b border-border px-4 py-3">
        <Show
          when={store.board}
          fallback={
            <Show when={agg.loading} fallback={<div class="min-h-[4rem] min-w-0 flex-1" aria-hidden="true" />}>
              <div
                class="min-w-0 flex-1 transition-opacity ease-out"
                style={{ 'transition-duration': `${SKELETON_FADE_MS}ms` }}
                classList={{
                  'opacity-0': !boardSkeletonVisible(),
                  'opacity-100': boardSkeletonVisible(),
                }}
                aria-busy="true"
              >
                <BoardHeaderSkeleton />
              </div>
            </Show>
          }
        >
          <BoardHeader board={store.board!} statsLine={statsLine} />
        </Show>
      </div>

      <BoardPopulateBanner progress={populateLive} />

      <Show when={store.loadError}>
        <p class="px-4 py-2 text-sm text-danger">{store.loadError}</p>
      </Show>

      <Show when={!agg.loading || store.board} fallback={<BoardLoadingSkeleton visible={boardSkeletonVisible} />}>
        <Show when={store.board} keyed>
          {(b) => (
            <BoardPanCanvas
              boardId={params.boardId}
              board={b}
              view={view}
              setView={setView}
              pan={pan}
              setPan={setPan}
              beginPan={beginPan}
              onWheelCanvas={onWheelCanvas}
              setBoard={setBoard}
              setColumnEl={setColumnEl}
              setTaskAreaEl={setTaskAreaEl}
              boardDrag={boardDrag}
              startBoardDrag={startBoardDrag}
              onBoardError={() => setStore('loadError', copy.somethingWrong)}
              columnElLookup={(id) => columnEls.get(id)}
              onViewportRef={follow.setViewport}
            />
          )}
        </Show>
      </Show>
    </div>
  )
}
