import type { AggregateBoardResponse } from './api'
import { clearBoardDragGhostPending, syncBoardDragGhostPosition } from './boardDragGhostDom'
import {
  BOARD_DRAG_ACTIVATION_PX,
  buildColumnCenterXsSorted,
  columnSlotFromSortedCenterXs,
} from './boardPointerDnD'
import type { BoardDragPayload, BoardDragState, TaskDropPreview } from '../routes/board/boardDragTypes'
import type { Setter } from 'solid-js'

export type BoardDragSessionContext = {
  getBoard: () => AggregateBoardResponse | null
  boardId: string
  getBoardDrag: () => BoardDragState | null
  setBoardDrag: Setter<BoardDragState | null>
  getColumnEl: (columnId: string) => HTMLElement | undefined
  columnSlotAtClientX: (clientX: number) => number
  taskDropActiveAtPoint: (
    clientX: number,
    clientY: number,
    sourceColumnId: string,
    taskId: string,
  ) => TaskDropPreview | null
  commitColumnToSlot: (columnId: string, slot: number) => void
  commitTaskToSlot: (
    taskId: string,
    fromColumnId: string,
    targetColumnId: string,
    insertIndex: number,
  ) => void
}

/**
 * Pointer-driven column / task drag: ghost position syncs every pointermove (GPU-friendly DOM);
 * drop slot / task hit-test batch to rAF so Solid updates stay cheap.
 */
export function attachBoardDragPointerSession(
  e: PointerEvent,
  payload: BoardDragPayload,
  ctx: BoardDragSessionContext,
): void {
  if (ctx.getBoardDrag()) return
  if (e.button !== 0) return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  let lastState: BoardDragState | null = null
  let columnDragCenters: number[] | null = null

  let colMoveRaf: number | null = null
  let pendingColXY: { x: number; y: number } | null = null

  let taskMoveRaf: number | null = null
  let pendingTaskXY: { x: number; y: number } | null = null

  const applyColumnDragSlot = (clientX: number, clientY: number) => {
    ctx.setBoardDrag((prev) => {
      if (!prev || prev.phase !== 'dragging' || prev.kind !== 'column' || prev.pointerId !== e.pointerId) {
        return prev
      }
      const slot = columnDragCenters
        ? columnSlotFromSortedCenterXs(columnDragCenters, clientX)
        : ctx.columnSlotAtClientX(clientX)
      const next: BoardDragState = {
        ...prev,
        clientX,
        clientY,
        columnDropSlot: slot,
      }
      lastState = next
      return next
    })
  }

  const flushColDragSlot = () => {
    colMoveRaf = null
    const p = pendingColXY
    pendingColXY = null
    if (p) applyColumnDragSlot(p.x, p.y)
  }

  const scheduleColDragSlot = (clientX: number, clientY: number) => {
    pendingColXY = { x: clientX, y: clientY }
    if (colMoveRaf != null) return
    colMoveRaf = requestAnimationFrame(flushColDragSlot)
  }

  const applyTaskDragHitTest = (clientX: number, clientY: number) => {
    ctx.setBoardDrag((prev) => {
      if (!prev || prev.phase !== 'dragging' || prev.kind !== 'task' || prev.pointerId !== e.pointerId) {
        return prev
      }
      const next: BoardDragState = {
        ...prev,
        clientX,
        clientY,
        taskDrop: ctx.taskDropActiveAtPoint(clientX, clientY, prev.sourceColumnId, prev.taskId),
      }
      lastState = next
      return next
    })
  }

  const flushTaskDragHitTest = () => {
    taskMoveRaf = null
    const p = pendingTaskXY
    pendingTaskXY = null
    if (p) applyTaskDragHitTest(p.x, p.y)
  }

  const scheduleTaskDragHitTest = (clientX: number, clientY: number) => {
    pendingTaskXY = { x: clientX, y: clientY }
    if (taskMoveRaf != null) return
    taskMoveRaf = requestAnimationFrame(flushTaskDragHitTest)
  }

  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }

  const pending: BoardDragState = {
    phase: 'pending',
    pointerId: e.pointerId,
    originX: e.clientX,
    originY: e.clientY,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    ...payload,
  }
  lastState = pending
  ctx.setBoardDrag(pending)

  const threshold2 = BOARD_DRAG_ACTIVATION_PX * BOARD_DRAG_ACTIVATION_PX
  const detach = () => {
    if (colMoveRaf != null) {
      cancelAnimationFrame(colMoveRaf)
      colMoveRaf = null
    }
    if (taskMoveRaf != null) {
      cancelAnimationFrame(taskMoveRaf)
      taskMoveRaf = null
    }
    pendingColXY = null
    pendingTaskXY = null
    columnDragCenters = null
    clearBoardDragGhostPending()
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', end)
    el.removeEventListener('pointercancel', end)
  }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    ev.preventDefault()

    const cur = ctx.getBoardDrag()

    if (cur?.phase === 'dragging' && cur.kind === 'column') {
      syncBoardDragGhostPosition(ev.clientX, ev.clientY, cur.offsetX, cur.offsetY)
      scheduleColDragSlot(ev.clientX, ev.clientY)
      return
    }

    if (cur?.phase === 'dragging' && cur.kind === 'task') {
      syncBoardDragGhostPosition(ev.clientX, ev.clientY, cur.offsetX, cur.offsetY)
      scheduleTaskDragHitTest(ev.clientX, ev.clientY)
      return
    }

    ctx.setBoardDrag((prev) => {
      if (!prev || prev.pointerId !== ev.pointerId) return prev
      if (prev.phase === 'pending') {
        const dx = ev.clientX - prev.originX
        const dy = ev.clientY - prev.originY
        if (dx * dx + dy * dy < threshold2) return prev
        if (prev.kind === 'column') {
          const b = ctx.getBoard()
          columnDragCenters = b
            ? buildColumnCenterXsSorted(b.columns, (id) => ctx.getColumnEl(id))
            : null
          const slot = columnDragCenters
            ? columnSlotFromSortedCenterXs(columnDragCenters, ev.clientX)
            : ctx.columnSlotAtClientX(ev.clientX)
          const next: BoardDragState = {
            phase: 'dragging',
            pointerId: prev.pointerId,
            offsetX: prev.offsetX,
            offsetY: prev.offsetY,
            width: prev.width,
            height: prev.height,
            clientX: ev.clientX,
            clientY: ev.clientY,
            columnDropSlot: slot,
            kind: 'column',
            columnId: prev.columnId,
            title: prev.title,
            sub: prev.sub,
          }
          lastState = next
          return next
        }
        const next: BoardDragState = {
          phase: 'dragging',
          pointerId: prev.pointerId,
          offsetX: prev.offsetX,
          offsetY: prev.offsetY,
          width: prev.width,
          height: prev.height,
          clientX: ev.clientX,
          clientY: ev.clientY,
          taskDrop: ctx.taskDropActiveAtPoint(ev.clientX, ev.clientY, prev.sourceColumnId, prev.taskId),
          kind: 'task',
          sourceColumnId: prev.sourceColumnId,
          taskId: prev.taskId,
          title: prev.title,
          sub: prev.sub,
        }
        lastState = next
        return next
      }
      return prev
    })

    const fin = ctx.getBoardDrag()
    if (fin?.phase === 'dragging') {
      syncBoardDragGhostPosition(ev.clientX, ev.clientY, fin.offsetX, fin.offsetY)
      if (fin.kind === 'column') {
        scheduleColDragSlot(ev.clientX, ev.clientY)
      } else if (fin.kind === 'task') {
        scheduleTaskDragHitTest(ev.clientX, ev.clientY)
      }
    }
  }

  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    if (colMoveRaf != null) {
      cancelAnimationFrame(colMoveRaf)
      colMoveRaf = null
    }
    if (taskMoveRaf != null) {
      cancelAnimationFrame(taskMoveRaf)
      taskMoveRaf = null
    }
    const pc = pendingColXY
    pendingColXY = null
    if (pc && lastState?.phase === 'dragging' && lastState.kind === 'column') {
      applyColumnDragSlot(pc.x, pc.y)
    }
    const pt = pendingTaskXY
    pendingTaskXY = null
    if (pt && lastState?.phase === 'dragging' && lastState.kind === 'task') {
      applyTaskDragHitTest(pt.x, pt.y)
    }
    detach()
    try {
      if (el.hasPointerCapture(ev.pointerId)) el.releasePointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
    const st = lastState
    lastState = null
    ctx.setBoardDrag(null)
    if (!st || st.phase !== 'dragging') return
    if (st.kind === 'column') {
      ctx.commitColumnToSlot(st.columnId, st.columnDropSlot)
    } else if (st.taskDrop) {
      ctx.commitTaskToSlot(st.taskId, st.sourceColumnId, st.taskDrop.columnId, st.taskDrop.insertIndex)
    }
  }

  const peOpts = { passive: false }
  el.addEventListener('pointermove', onMove, peOpts)
  el.addEventListener('pointerup', end, peOpts)
  el.addEventListener('pointercancel', end, peOpts)
}
