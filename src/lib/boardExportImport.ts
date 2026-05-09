import {
  createColumn,
  createTask,
  type AggregateBoardResponse,
} from './api'
import type { PopulateStressLiveHooks } from './populateStressBoard'

export const BOARD_EXPORT_FORMAT = 'goroutine-board-export' as const

export type BoardExportV1 = {
  format: typeof BOARD_EXPORT_FORMAT
  version: 1
  board: { name: string; description: string }
  columns: Array<{
    name: string
    description: string
    tasks: Array<{ name: string; description: string }>
  }>
}

function asString(x: unknown, fallback = ''): string {
  return typeof x === 'string' ? x : fallback
}

export function serializeBoardToExport(board: AggregateBoardResponse): BoardExportV1 {
  const cols = [...board.columns].sort((a, b) => a.position - b.position)
  return {
    format: BOARD_EXPORT_FORMAT,
    version: 1,
    board: {
      name: board.name,
      description: board.description ?? '',
    },
    columns: cols.map((c) => ({
      name: c.name,
      description: c.description ?? '',
      tasks: [...c.tasks]
        .sort((a, b) => a.position - b.position)
        .map((t) => ({
          name: t.name,
          description: t.description ?? '',
        })),
    })),
  }
}

export function parseBoardExportJson(raw: string): BoardExportV1 {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (!obj || typeof obj !== 'object') throw new Error('Invalid export root')
  const root = obj as Record<string, unknown>
  if (root.format !== BOARD_EXPORT_FORMAT) throw new Error('Not a Goroutine board export file')
  if (root.version !== 1) throw new Error('Unsupported export version')

  const boardObj = root.board
  if (!boardObj || typeof boardObj !== 'object') throw new Error('Missing board')
  const b = boardObj as Record<string, unknown>

  const colsRaw = root.columns
  if (!Array.isArray(colsRaw)) throw new Error('columns must be an array')

  const columns = colsRaw.map((col, ci) => {
    if (!col || typeof col !== 'object') throw new Error(`Invalid column at index ${ci}`)
    const c = col as Record<string, unknown>
    const tasksRaw = c.tasks
    if (!Array.isArray(tasksRaw)) throw new Error(`columns[${ci}].tasks must be an array`)
    const tasks = tasksRaw.map((task, ti) => {
      if (!task || typeof task !== 'object') throw new Error(`Invalid task at columns[${ci}].tasks[${ti}]`)
      const t = task as Record<string, unknown>
      const name = asString(t.name).trim() || 'Untitled'
      return {
        name,
        description: asString(t.description),
      }
    })
    const name = asString(c.name).trim() || `Column ${ci + 1}`
    return {
      name,
      description: asString(c.description),
      tasks,
    }
  })

  const boardName = asString(b.name).trim() || 'Imported board'

  return {
    format: BOARD_EXPORT_FORMAT,
    version: 1,
    board: {
      name: boardName,
      description: asString(b.description),
    },
    columns,
  }
}

const runBatched = async <T,>(items: T[], size: number, worker: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    await Promise.all(slice.map((item) => worker(item)))
  }
}

const TASK_CONCURRENCY = 1024

/**
 * Creates columns and tasks from an export snapshot (same hook shape as stress populate).
 */
export async function runImportBoardLive(
  boardId: string,
  payload: BoardExportV1,
  hooks: PopulateStressLiveHooks,
): Promise<void> {
  const { columns } = payload
  const colCount = columns.length
  const taskCounts = columns.map((c) => c.tasks.length)
  const totalTasks = taskCounts.reduce((a, n) => a + n, 0)
  const totalSteps = colCount + totalTasks

  let done = 0
  const bump = (line: string) => {
    done += 1
    hooks.onProgress({ done, total: totalSteps, line })
  }

  hooks.onProgress({ done: 0, total: totalSteps, line: 'Creating columns…' })

  const columnIds: string[] = new Array(colCount)
  await Promise.all(
    columns.map((colDef, i) =>
      createColumn(boardId, {
        name: colDef.name,
        description: colDef.description,
      }).then(({ data: col }) => {
        columnIds[i] = col.id
        hooks.onColumn(col)
        bump(`Column ${i + 1} / ${colCount}`)
      }),
    ),
  )

  type TaskJob = { columnId: string; colIdx: number; taskIdx: number }
  const jobs: TaskJob[] = []
  for (let i = 0; i < colCount; i++) {
    const columnId = columnIds[i]!
    const tasks = columns[i]!.tasks
    for (let j = 0; j < tasks.length; j++) {
      jobs.push({ columnId, colIdx: i, taskIdx: j })
    }
  }

  let tasksFinished = 0
  await runBatched(jobs, TASK_CONCURRENCY, async (job) => {
    const taskDef = columns[job.colIdx]!.tasks[job.taskIdx]!
    const { data: task } = await createTask(boardId, job.columnId, {
      name: taskDef.name,
      description: taskDef.description,
    })
    hooks.onTask(task)
    tasksFinished += 1
    bump(`Tasks ${tasksFinished} / ${totalTasks}`)
  })
}

export async function copyBoardExportToClipboard(payload: BoardExportV1): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
}
