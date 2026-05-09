import { unwrap } from 'solid-js/store'
import { POSITION_BASE } from './api'
import type { AggregateBoardResponse, AggregateColumnResponse, TaskResponse } from './api'

/** True if dropping columnId into slotIndex would not change column order (cheap guard). */
export function columnReorderIsNoop(
  columns: AggregateColumnResponse[],
  columnId: string,
  slotIndex: number,
): boolean {
  const from = columns.findIndex((c) => c.id === columnId)
  if (from === -1) return true
  let insert = slotIndex
  if (from < insert) insert -= 1
  return from === insert
}

export function moveColumnToSlot(
  columns: AggregateColumnResponse[],
  columnId: string,
  slotIndex: number,
): AggregateColumnResponse[] {
  const from = columns.findIndex((c) => c.id === columnId)
  if (from === -1) return columns
  const arr = columns.slice()
  const [moved] = arr.splice(from, 1)
  let insert = slotIndex
  if (from < insert) insert -= 1
  arr.splice(insert, 0, moved!)
  for (let i = 0; i < arr.length; i++) {
    const p = i + POSITION_BASE
    const c = arr[i]!
    if (c.position !== p) {
      arr[i] = { ...c, position: p }
    }
  }
  return arr
}

export function moveTaskTo(
  board: AggregateBoardResponse,
  taskId: string,
  targetColumnId: string,
  targetIndex: number,
): AggregateBoardResponse {
  const b = unwrap(board) as AggregateBoardResponse

  let sourceCol: AggregateColumnResponse | undefined
  let fromIdx = -1
  for (const col of b.columns) {
    const ti = col.tasks.findIndex((t) => t.id === taskId)
    if (ti !== -1) {
      sourceCol = col
      fromIdx = ti
      break
    }
  }
  if (!sourceCol || fromIdx === -1) return board

  const destCol = b.columns.find((c) => c.id === targetColumnId)
  if (!destCol) return board

  const task = sourceCol.tasks[fromIdx]!
  const renumber = (tasks: TaskResponse[]) =>
    tasks.map((t, i) => ({ ...t, position: i + POSITION_BASE }))

  if (sourceCol.id === targetColumnId) {
    const without = sourceCol.tasks.filter((_, i) => i !== fromIdx)
    const moved: TaskResponse = { ...task, columnId: targetColumnId }
    const idx = Math.max(0, Math.min(targetIndex, without.length))
    const nextTasks = [...without.slice(0, idx), moved, ...without.slice(idx)]
    const newCol: AggregateColumnResponse = { ...sourceCol, tasks: renumber(nextTasks) }
    return { ...b, columns: b.columns.map((c) => (c.id === sourceCol.id ? newCol : c)) }
  }

  const fromWithout = sourceCol.tasks.filter((_, i) => i !== fromIdx)
  const moved: TaskResponse = { ...task, columnId: targetColumnId }
  const toInserted = [...destCol.tasks]
  const idx = Math.max(0, Math.min(targetIndex, toInserted.length))
  toInserted.splice(idx, 0, moved)

  const newSource: AggregateColumnResponse = { ...sourceCol, tasks: renumber(fromWithout) }
  const newDest: AggregateColumnResponse = { ...destCol, tasks: renumber(toInserted) }

  return {
    ...b,
    columns: b.columns.map((c) => {
      if (c.id === sourceCol.id) return newSource
      if (c.id === targetColumnId) return newDest
      return c
    }),
  }
}
