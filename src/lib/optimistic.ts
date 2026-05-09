import { unwrap } from 'solid-js/store'
import type { AggregateBoardResponse } from './api'

/** Clone board for column-reorder rollback only (same task refs — no per-task spread). */
export function cloneBoardShallowColumns(b: AggregateBoardResponse): AggregateBoardResponse {
  const u = unwrap(b) as AggregateBoardResponse
  return {
    ...u,
    columns: u.columns.map((c) => ({
      ...c,
      tasks: c.tasks,
    })),
  }
}

/** Clone for optimistic rollback (shallow tree; no structuredClone — large boards stay responsive). */
export function cloneBoard(b: AggregateBoardResponse): AggregateBoardResponse {
  const u = unwrap(b) as AggregateBoardResponse
  return {
    ...u,
    columns: u.columns.map((c) => ({
      ...c,
      tasks: c.tasks.map((t) => ({ ...t })),
    })),
  }
}
