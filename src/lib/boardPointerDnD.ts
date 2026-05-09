import type { AggregateBoardResponse, AggregateColumnResponse } from './api'

/** Pixels pointer must move before a drag starts (clicks vs drag). */
export const BOARD_DRAG_ACTIVATION_PX = 8

export function taskInsertIndexFromPointIgnoring(
  columnEl: HTMLElement,
  clientY: number,
  draggingTaskId: string,
): number {
  const nodes = Array.from(columnEl.querySelectorAll('[data-task-id]')) as HTMLElement[]
  const filtered = nodes.filter((node) => node.dataset.taskId !== draggingTaskId)
  for (let i = 0; i < filtered.length; i++) {
    const r = filtered[i]!.getBoundingClientRect()
    if (clientY < r.top + r.height / 2) return i
  }
  return filtered.length
}

/** Slot from precomputed column center Xs (left→right), same rule as {@link columnReorderSlot}. */
export function columnSlotFromSortedCenterXs(sortedCx: number[], clientX: number): number {
  let slot = 0
  for (const cx of sortedCx) {
    if (clientX >= cx) slot += 1
  }
  return slot
}

/** One-time geometry for fast column slot while dragging (avoids N× getBoundingClientRect per move). */
export function buildColumnCenterXsSorted(
  columns: AggregateColumnResponse[],
  getColumnEl: (columnId: string) => HTMLElement | undefined,
): number[] | null {
  const parts: { cx: number; left: number }[] = []
  for (const c of columns) {
    const r = getColumnEl(c.id)?.getBoundingClientRect()
    if (!r) return null
    parts.push({ cx: r.left + r.width / 2, left: r.left })
  }
  parts.sort((a, b) => a.left - b.left)
  return parts.map((p) => p.cx)
}

/** Slot index 0..columns.length — insert before column `slot` (n = after last). */
export function columnReorderSlot(
  clientX: number,
  columns: AggregateColumnResponse[],
  getColumnEl: (columnId: string) => HTMLElement | undefined,
): number {
  let slot = 0
  for (const column of columns) {
    const rect = getColumnEl(column.id)?.getBoundingClientRect()
    if (!rect) continue
    const cx = rect.left + rect.width / 2
    if (clientX >= cx) slot += 1
  }
  return slot
}

export function taskColumnIdFromPoint(
  columns: AggregateColumnResponse[],
  clientX: number,
  clientY: number,
  getTaskAreaEl: (columnId: string) => HTMLElement | undefined,
  getColumnEl: (columnId: string) => HTMLElement | undefined,
): string | null {
  for (const column of columns) {
    const taskAreaRect = getTaskAreaEl(column.id)?.getBoundingClientRect()
    if (
      taskAreaRect &&
      clientX >= taskAreaRect.left &&
      clientX <= taskAreaRect.right &&
      clientY >= taskAreaRect.top &&
      clientY <= taskAreaRect.bottom
    ) {
      return column.id
    }
  }

  for (const column of columns) {
    const columnRect = getColumnEl(column.id)?.getBoundingClientRect()
    if (
      columnRect &&
      clientX >= columnRect.left &&
      clientX <= columnRect.right &&
      clientY >= columnRect.top &&
      clientY <= columnRect.bottom
    ) {
      return column.id
    }
  }

  return null
}

/** Drop target from hit-test, or null if the task would stay at the same index (no UI / no commit). */
export function taskDropIfMoves(
  board: AggregateBoardResponse,
  sourceColumnId: string,
  taskId: string,
  raw: { columnId: string; insertIndex: number } | null,
): { columnId: string; insertIndex: number } | null {
  if (!raw) return null
  const col = board.columns.find((c) => c.id === sourceColumnId)
  const fromIdx = col?.tasks.findIndex((t) => t.id === taskId) ?? -1
  if (fromIdx === -1) return null
  if (raw.columnId === sourceColumnId && raw.insertIndex === fromIdx) return null
  return raw
}

/**
 * Hit-test insert index is in "list without dragged card" space when dragging inside the same column.
 * Map it to "line before task at index" in the full `<For>` list (0..n, where n = after last task).
 */
export function taskDropLineBeforeFullIndex(
  raw: { columnId: string; insertIndex: number },
  sourceColumnId: string,
  draggingTaskId: string,
  columnTasks: { id: string }[],
): number {
  const fromIdx = columnTasks.findIndex((t) => t.id === draggingTaskId)
  const fi = raw.insertIndex
  if (raw.columnId !== sourceColumnId || fromIdx === -1) return fi
  return fi <= fromIdx ? fi : fi + 1
}

/** Viewport X (center of gap) and vertical span for a fixed-position drop bar while reordering columns. */
export function columnDropIndicatorMetrics(
  slot: number,
  columns: AggregateColumnResponse[],
  getColumnEl: (columnId: string) => HTMLElement | undefined,
): { x: number; top: number; height: number } | null {
  const n = columns.length
  if (n === 0) return null
  const inset = 6
  if (slot <= 0) {
    const r = getColumnEl(columns[0]!.id)?.getBoundingClientRect()
    if (!r) return null
    return { x: r.left - inset, top: r.top, height: r.height }
  }
  if (slot >= n) {
    const r = getColumnEl(columns[n - 1]!.id)?.getBoundingClientRect()
    if (!r) return null
    return { x: r.right + inset, top: r.top, height: r.height }
  }
  const left = getColumnEl(columns[slot - 1]!.id)?.getBoundingClientRect()
  const right = getColumnEl(columns[slot]!.id)?.getBoundingClientRect()
  if (!left || !right) return null
  return {
    x: (left.right + right.left) / 2,
    top: Math.min(left.top, right.top),
    height: Math.max(left.bottom, right.bottom) - Math.min(left.top, right.top),
  }
}

export function sameColumnOrder(
  left: AggregateColumnResponse[],
  right: AggregateColumnResponse[],
): boolean {
  return left.length === right.length && left.every((column, index) => column.id === right[index]?.id)
}

export function sameTaskLayout(left: AggregateBoardResponse, right: AggregateBoardResponse): boolean {
  return (
    left.columns.length === right.columns.length &&
    left.columns.every((column, columnIdx) => {
      const other = right.columns[columnIdx]
      return (
        column.id === other?.id &&
        column.tasks.length === other.tasks.length &&
        column.tasks.every((task, taskIdx) => task.id === other.tasks[taskIdx]?.id)
      )
    })
  )
}
