const PAD = 28

function applyFollow(viewport: HTMLElement, target: HTMLElement, pan: (dx: number, dy: number) => void) {
  const vpRect = viewport.getBoundingClientRect()
  const r = target.getBoundingClientRect()
  let dx = 0
  let dy = 0
  if (r.right > vpRect.right - PAD) dx -= r.right - (vpRect.right - PAD)
  if (r.left < vpRect.left + PAD) dx += vpRect.left + PAD - r.left
  if (r.bottom > vpRect.bottom - PAD) dy -= r.bottom - (vpRect.bottom - PAD)
  if (r.top < vpRect.top + PAD) dy += vpRect.top + PAD - r.top
  if (dx !== 0 || dy !== 0) pan(dx, dy)
}

/**
 * After layout, pan the board canvas so `resolveTarget()` lies inside the viewport rect (with padding).
 * Retries a few animation frames if the node is not mounted yet (e.g. new column from `<For>`).
 */
export function scheduleBoardEntityIntoView(
  viewport: HTMLElement | undefined,
  resolveTarget: () => HTMLElement | undefined,
  pan: (dxScreen: number, dyScreen: number) => void,
) {
  if (!viewport) return
  const tryFollow = (attemptsLeft: number) => {
    const t = resolveTarget()
    if (t) {
      applyFollow(viewport, t, pan)
      return
    }
    if (attemptsLeft <= 0) return
    requestAnimationFrame(() => tryFollow(attemptsLeft - 1))
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => tryFollow(6))
  })
}
