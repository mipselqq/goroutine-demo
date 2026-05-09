import { createSignal } from 'solid-js'

const [pendingCount, setPendingCount] = createSignal(0)

export function trackPending<T>(promise: Promise<T>): Promise<T> {
  setPendingCount((n) => n + 1)
  return promise.finally(() => {
    setPendingCount((n) => Math.max(0, n - 1))
  })
}

export { pendingCount }
