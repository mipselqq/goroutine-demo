const KEY = 'goroutine-kanban-board-counts'

type Entry = { columns: number; tasks: number }

function readAll(): Record<string, Entry> {
  try {
    const s = sessionStorage.getItem(KEY)
    if (!s) return {}
    const p = JSON.parse(s) as unknown
    if (!p || typeof p !== 'object') return {}
    return p as Record<string, Entry>
  } catch {
    return {}
  }
}

export function getCachedBoardCounts(boardId: string): Entry | null {
  const e = readAll()[boardId]
  return e && typeof e.columns === 'number' && typeof e.tasks === 'number' ? e : null
}

/** Call when aggregate board is shown so the boards list can show counts after a visit. */
export function setCachedBoardCounts(boardId: string, columns: number, tasks: number) {
  const all = readAll()
  all[boardId] = { columns, tasks }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* quota / private mode */
  }
}
