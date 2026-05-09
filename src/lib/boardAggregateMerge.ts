import type { AggregateBoardResponse, ColumnResponse, TaskResponse } from './api'

export function mergeCreatedColumnIntoBoard(
  draft: AggregateBoardResponse | null,
  boardId: string,
  col: ColumnResponse,
): void {
  if (!draft || draft.id !== boardId) return
  if (draft.columns.some((c) => c.id === col.id)) return
  draft.columns.push({ ...col, tasks: [] })
  draft.columns.sort((a, b) => a.position - b.position)
}

export function mergeCreatedTaskIntoBoard(
  draft: AggregateBoardResponse | null,
  boardId: string,
  task: TaskResponse,
): void {
  if (!draft || draft.id !== boardId) return
  const col = draft.columns.find((c) => c.id === task.columnId)
  if (!col) return
  if (col.tasks.some((t) => t.id === task.id)) return
  col.tasks.push(task)
  col.tasks.sort((a, b) => a.position - b.position)
}
