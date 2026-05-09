import { copy } from './copy'
import type { DetailedError } from './api'

function parseDetailedBody(body: unknown): DetailedError | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const o = body as Record<string, unknown>
  const code = typeof o.code === 'string' ? o.code : undefined
  let message = typeof o.message === 'string' ? o.message : undefined
  if (!message?.trim() && typeof o.error === 'string' && o.error.trim()) {
    message = o.error.trim()
  }
  const timestamp = typeof o.timestamp === 'string' ? o.timestamp : undefined
  let details: DetailedError['details']
  if (Array.isArray(o.details)) {
    details = o.details.map((item) => {
      if (!item || typeof item !== 'object') return {}
      const d = item as Record<string, unknown>
      const field = typeof d.field === 'string' ? d.field : undefined
      const issues = Array.isArray(d.issues)
        ? d.issues.filter((x): x is string => typeof x === 'string')
        : undefined
      return { field, issues }
    })
  }
  return { code, message, details, timestamp }
}

function humanizeField(field: string): string {
  const s = field.trim()
  if (!s) return 'Field'
  const words = s.split(/[\s_.]+/).filter(Boolean)
  if (words.length === 0) return 'Field'
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function formatValidationDetails(details: NonNullable<DetailedError['details']>): string {
  const lines: string[] = []
  for (const d of details) {
    const label = humanizeField(d.field ?? '')
    const issues = (d.issues ?? []).map((x) => x.trim()).filter(Boolean)
    if (issues.length) lines.push(`• ${label}: ${issues.join('; ')}`)
    else if (label !== 'Field') lines.push(`• ${label}`)
  }
  return lines.join('\n')
}

function messageForKnownCode(code: string): string | null {
  switch (code) {
    case 'BOARD_NOT_FOUND':
      return copy.errorBoardNotFound
    case 'COLUMN_NOT_FOUND':
      return copy.errorColumnNotFound
    case 'TASK_NOT_FOUND':
      return copy.errorTaskNotFound
    case 'USER_ALREADY_EXISTS':
      return copy.errorUserExists
    case 'INVALID_CREDENTIALS':
    case 'USER_NOT_FOUND':
      return copy.errorInvalidCredentials
    case 'INVALID_TOKEN':
    case 'INVALID_AUTH_HEADER':
      return copy.errorUnauthorized
    default:
      return null
  }
}

/**
 * Turns API error JSON ({@link DetailedError} / simple error) into copy users should see.
 * Omits timestamps and raw codes; expands validation `details` into bullet lines.
 */
export function formatDetailedErrorForUser(det: DetailedError, status: number): string {
  if (status >= 500) return copy.errorServer

  const code = det.code?.trim()
  const detailBlock = det.details?.length ? formatValidationDetails(det.details) : ''

  if (code === 'VALIDATION_ERROR') {
    if (detailBlock) return `${copy.errorValidationIntro}\n${detailBlock}`
    if (det.message?.trim()) return det.message.trim()
    return copy.errorValidationIntro
  }

  /** Some backends send `details` on 400/422 without `VALIDATION_ERROR`. */
  if (detailBlock && (status === 400 || status === 422)) {
    return `${copy.errorValidationIntro}\n${detailBlock}`
  }

  if (code) {
    const mapped = messageForKnownCode(code)
    if (mapped) return mapped
  }

  if (det.message?.trim()) return det.message.trim()

  if (status === 401) return copy.errorUnauthorized
  if (status === 404) return copy.errorNotFound

  return copy.somethingWrong
}

/** Safe user-visible message from a caught API/client error. */
export function userFacingApiError(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message.trim()
    if (m) return m
  }
  return copy.somethingWrong
}

/** Maps HTTP status + parsed JSON body to a single user-facing string (may contain newlines). */
export function formatHttpErrorMessage(status: number, body: unknown): string {
  const det = parseDetailedBody(body)
  if (det) return formatDetailedErrorForUser(det, status)

  if (typeof body === 'string' && body.trim()) return body.trim()

  if (status >= 500) return copy.errorServer
  if (status === 401) return copy.errorUnauthorized
  if (status === 404) return copy.errorNotFound

  return copy.somethingWrong
}
