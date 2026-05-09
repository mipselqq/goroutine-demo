import {
  createBoard,
  createColumn,
  createTask,
  type BoardResponse,
  type ColumnResponse,
  type TaskResponse,
} from './api'

export const POPULATE_STRESS_LOREM_DESC =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

export const POPULATE_SPEC_STORAGE_KEY = 'goroutine-populate-stress-spec'

export type PopulateStressSpec = {
  boardId: string
  colCount: number
  taskCounts: number[]
}

export function writePopulateStressSpec(spec: PopulateStressSpec) {
  sessionStorage.setItem(POPULATE_SPEC_STORAGE_KEY, JSON.stringify(spec))
}

/** Read and remove spec for this board only (single consumer). */
export function consumePopulateStressSpec(boardId: string): PopulateStressSpec | null {
  const raw = sessionStorage.getItem(POPULATE_SPEC_STORAGE_KEY)
  if (!raw) return null
  try {
    const spec = JSON.parse(raw) as PopulateStressSpec
    if (spec.boardId !== boardId || !Array.isArray(spec.taskCounts)) return null
    sessionStorage.removeItem(POPULATE_SPEC_STORAGE_KEY)
    return spec
  } catch {
    return null
  }
}

export type PopulateStressProgress = { done: number; total: number; line: string }

export type PopulateStressLiveHooks = {
  onProgress: (p: PopulateStressProgress) => void
  onColumn: (col: ColumnResponse) => void
  onTask: (task: TaskResponse) => void
}

export async function createStressBoardAndSpec(): Promise<{
  board: BoardResponse
  spec: Omit<PopulateStressSpec, 'boardId'>
}> {
  const colCount = 50
  const taskCounts = Array.from({ length: colCount }, () => 15 + Math.floor(Math.random() * 16))
  const { data: board } = await createBoard({
    name: `Populate stress ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    description: POPULATE_STRESS_LOREM_DESC.slice(0, 400),
  })
  return { board, spec: { colCount, taskCounts } }
}

const runBatched = async <T,>(items: T[], size: number, worker: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    await Promise.all(slice.map((item) => worker(item)))
  }
}

/**
 * Creates columns and tasks with high HTTP parallelism (many in-flight requests), invoking hooks for live UI.
 */
export async function runPopulateStressBoardLive(
  boardId: string,
  spec: Omit<PopulateStressSpec, 'boardId'>,
  hooks: PopulateStressLiveHooks,
): Promise<void> {
  const { colCount, taskCounts } = spec
  const totalTasks = taskCounts.reduce((a, n) => a + n, 0)
  const totalSteps = colCount + totalTasks
  let done = 0
  const bump = (line: string) => {
    done += 1
    hooks.onProgress({ done, total: totalSteps, line })
  }

  hooks.onProgress({ done: 0, total: totalSteps, line: 'Creating columns…' })

  const loremCol = POPULATE_STRESS_LOREM_DESC.slice(0, 240)
  const loremTask = POPULATE_STRESS_LOREM_DESC

  const columnIds: string[] = new Array(colCount)
  await Promise.all(
    Array.from({ length: colCount }, (_, i) =>
      createColumn(boardId, {
        name: `Column ${i + 1}`,
        description: loremCol,
      }).then(({ data: col }) => {
        columnIds[i] = col.id
        hooks.onColumn(col)
        bump(`Column ${i + 1} / ${colCount}`)
      }),
    ),
  )

  type TaskJob = { columnId: string; colIdx: number; j: number }
  const jobs: TaskJob[] = []
  for (let i = 0; i < colCount; i++) {
    const columnId = columnIds[i]!
    const n = taskCounts[i]!
    for (let j = 0; j < n; j++) {
      jobs.push({ columnId, colIdx: i, j })
    }
  }

  /** Many concurrent createTask calls (same order of magnitude as original stress tool). */
  const TASK_CONCURRENCY = 1024
  let tasksFinished = 0
  await runBatched(jobs, TASK_CONCURRENCY, async (job) => {
    const { data: task } = await createTask(boardId, job.columnId, {
      name: `Lorem task ${job.colIdx + 1}.${job.j + 1}`,
      description: loremTask,
    })
    hooks.onTask(task)
    tasksFinished += 1
    bump(`Tasks ${tasksFinished} / ${totalTasks}`)
  })
}
