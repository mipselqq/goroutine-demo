import { DESCRIPTION_MAX_CHARS, NAME_MAX_CHARS } from './api'
import { copy } from './copy'

/** Non-empty name after trim, max 128 chars (matches Go NewBoardName / NewColumnName / NewTaskName). */
export function validateEntityName(raw: string): string | null {
  const t = raw.trim()
  if (!t) return copy.validationNameRequired
  if (t.length > NAME_MAX_CHARS) return copy.validationNameTooLong
  return null
}

/** Optional description; trimmed length must be ≤ 1024 (matches domain descriptions). */
export function validateOptionalDescription(raw: string): string | null {
  if (raw.trim().length > DESCRIPTION_MAX_CHARS) return copy.validationDescriptionTooLong
  return null
}

/** Matches NewUserPassword: length ≥ 6 and not whitespace-only. */
export function validatePassword(raw: string): string | null {
  if (raw.length < 6 || raw.trim() === '') return copy.validationPasswordTooShort
  return null
}

/** Trimmed, non-empty, loose RFC-ish shape (aligned with net/mail.ParseAddress usage server-side). */
export function validateEmail(raw: string): string | null {
  const t = raw.trim()
  if (!t) return copy.validationEmailRequired
  const lower = t.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return copy.validationEmailInvalid
  return null
}
