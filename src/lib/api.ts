import { getToken } from './auth'
import { formatHttpErrorMessage } from './apiUserMessage'
import { trackPending } from './pending'

/** Remote API host (CORS must allow the SPA origin). */
const DEFAULT_API_BASE = 'https://goroutine.mipselqq.uk'

function resolveApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (raw === undefined || raw === null) return DEFAULT_API_BASE
  const t = String(raw).trim().replace(/\/$/, '')
  if (!t) return DEFAULT_API_BASE

  // Vite “proxy” style: relative base hits the dev server — use the real API host instead.
  if (import.meta.env.DEV && t.startsWith('/')) return DEFAULT_API_BASE

  try {
    const u = new URL(t)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return DEFAULT_API_BASE
    return t
  } catch {
    return DEFAULT_API_BASE
  }
}

export const API_BASE = resolveApiBase()

/** API uses 1-based positions for move endpoints (matches Swagger examples). */
export const POSITION_BASE = 1

export type DetailedError = {
  code?: string
  message?: string
  details?: Array<{ field?: string; issues?: string[] }>
  timestamp?: string
}

export type StatusResponse = { status: string }

export type LoginBody = { email: string; password: string }
export type LoginResponse = { token: string }

export type RegisterBody = { email: string; password: string }

export type WhoAmIResponse = { uid: string }

export type BoardResponse = {
  id: string
  name: string
  description: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export type TaskResponse = {
  id: string
  columnId: string
  name: string
  description: string
  position: number
  createdAt: string
  updatedAt: string
}

export type ColumnResponse = {
  id: string
  boardId: string
  name: string
  description: string
  position: number
  createdAt: string
  updatedAt: string
}

export type AggregateColumnResponse = ColumnResponse & { tasks: TaskResponse[] }

export type AggregateBoardResponse = BoardResponse & {
  columns: AggregateColumnResponse[]
}

export type CreateBoardBody = { name?: string; description?: string }
export type UpdateBoardBody = { name?: string | null; description?: string | null }

export type CreateColumnBody = { name?: string; description?: string }
export type UpdateColumnBody = { name?: string | null; description?: string | null }

export type CreateTaskBody = { name?: string; description?: string }
export type UpdateTaskBody = { name?: string | null; description?: string | null }

/** Matches server domain validation (board/column/task names). */
export const NAME_MAX_CHARS = 128

/** Matches server validation (board / column / task descriptions). */
export const DESCRIPTION_MAX_CHARS = 1024
export const TASK_DESCRIPTION_MAX_CHARS = DESCRIPTION_MAX_CHARS

export type MoveColumnBody = { targetPosition: number }
export type ColumnPositionResponse = { position: number }

export type MoveTaskBody = { targetColumnId: string; targetPosition: number }
export type TaskPositionResponse = { columnId: string; position: number }

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

type RequestOpts = {
  method?: string
  body?: unknown
  auth?: boolean
  /** Count toward global “awaiting server” badge */
  mutation?: boolean
}

export async function apiRequest<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<{ res: Response; data: T }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (opts.auth !== false) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  const url = `${API_BASE}${path}`
  const exec = fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).then(async (res) => {
    const data = (await parseJson(res)) as T
    if (!res.ok) {
      const msg = formatHttpErrorMessage(res.status, data)
      throw new ApiError(msg, res.status, data)
    }
    return { res, data }
  })
  const wrapped = opts.mutation ? trackPending(exec) : exec
  return wrapped
}

/* ——— Auth ——— */
export function login(body: LoginBody) {
  return apiRequest<LoginResponse>('/v1/login', {
    method: 'POST',
    body,
    auth: false,
    mutation: true,
  })
}

export function register(body: RegisterBody) {
  return apiRequest<StatusResponse>('/v1/register', {
    method: 'POST',
    body,
    auth: false,
    mutation: true,
  })
}

export function whoAmI() {
  return apiRequest<WhoAmIResponse>('/v1/whoami', {})
}

/* ——— Boards ——— */
export function listBoards() {
  return apiRequest<BoardResponse[]>('/v1/boards', {})
}

export function createBoard(body: CreateBoardBody) {
  return apiRequest<BoardResponse>('/v1/boards', {
    method: 'POST',
    body,
    mutation: true,
  })
}

export function getBoard(boardId: string) {
  return apiRequest<BoardResponse>(`/v1/boards/${encodeURIComponent(boardId)}`, {})
}

export function getBoardAggregate(boardId: string) {
  return apiRequest<AggregateBoardResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/aggregate`,
    {},
  )
}

export function patchBoard(boardId: string, body: UpdateBoardBody) {
  return apiRequest<BoardResponse>(`/v1/boards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    body,
    mutation: true,
  })
}

export function deleteBoard(boardId: string) {
  return apiRequest<null>(`/v1/boards/${encodeURIComponent(boardId)}`, {
    method: 'DELETE',
    mutation: true,
  })
}

/* ——— Columns ——— */
export function createColumn(boardId: string, body: CreateColumnBody) {
  return apiRequest<ColumnResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns`,
    { method: 'POST', body, mutation: true },
  )
}

export function patchColumn(boardId: string, columnId: string, body: UpdateColumnBody) {
  return apiRequest<ColumnResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}`,
    { method: 'PATCH', body, mutation: true },
  )
}

export function deleteColumn(boardId: string, columnId: string) {
  return apiRequest<null>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}`,
    { method: 'DELETE', mutation: true },
  )
}

export function moveColumn(boardId: string, columnId: string, body: MoveColumnBody) {
  return apiRequest<ColumnPositionResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/position`,
    { method: 'PUT', body, mutation: true },
  )
}

/* ——— Tasks ——— */
export function createTask(boardId: string, columnId: string, body: CreateTaskBody) {
  return apiRequest<TaskResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/tasks`,
    { method: 'POST', body, mutation: true },
  )
}

export function patchTask(
  boardId: string,
  columnId: string,
  taskId: string,
  body: UpdateTaskBody,
) {
  return apiRequest<TaskResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'PATCH', body, mutation: true },
  )
}

export function deleteTask(boardId: string, columnId: string, taskId: string) {
  return apiRequest<null>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: 'DELETE', mutation: true },
  )
}

export function moveTask(
  boardId: string,
  columnId: string,
  taskId: string,
  body: MoveTaskBody,
) {
  return apiRequest<TaskPositionResponse>(
    `/v1/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}/tasks/${encodeURIComponent(taskId)}/position`,
    { method: 'PUT', body, mutation: true },
  )
}

export function sortAggregate(board: AggregateBoardResponse): AggregateBoardResponse {
  const cols = [...board.columns]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      ...c,
      tasks: [...c.tasks].sort((a, b) => a.position - b.position),
    }))
  return { ...board, columns: cols }
}
