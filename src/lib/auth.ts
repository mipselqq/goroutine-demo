import { createSignal } from 'solid-js'

const KEY = 'goroutine_token'

const [authEpoch, setAuthEpoch] = createSignal(0)

/** Read in reactive contexts so UI updates after login/logout */
export function getAuthEpoch() {
  return authEpoch()
}

function bumpAuth() {
  setAuthEpoch((n) => n + 1)
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  localStorage.setItem(KEY, token)
  bumpAuth()
}

export function clearToken() {
  localStorage.removeItem(KEY)
  bumpAuth()
}
