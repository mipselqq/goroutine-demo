/**
 * Drag ghost lives outside Solid's reactive position updates so it can follow the pointer
 * at display refresh rate (Chrome otherwise ties it to one setState per rAF ≈ half fluid motion).
 */
let ghostEl: HTMLElement | null = null
let ghostScale = 1
/** Last pointer position for reappling transform after scale-only updates. */
let lastGhost: { cx: number; cy: number; ox: number; oy: number } | null = null
let pending: { cx: number; cy: number; ox: number; oy: number } | null = null

export function setBoardDragGhostScale(s: number) {
  ghostScale = Number.isFinite(s) && s > 0 ? s : 1
  if (ghostEl && lastGhost) {
    applyGhostTransform(lastGhost.cx, lastGhost.cy, lastGhost.ox, lastGhost.oy)
  }
  if (ghostEl && pending) {
    applyGhostTransform(pending.cx, pending.cy, pending.ox, pending.oy)
    pending = null
  }
}

function applyGhostTransform(cx: number, cy: number, ox: number, oy: number) {
  if (!ghostEl) return
  const x = cx - ox
  const y = cy - oy
  ghostEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${ghostScale})`
}

/** Ghost root: fixed; motion only via translate3d + scale (compositor-friendly). */
export function registerBoardDragGhostEl(el: HTMLElement | null) {
  ghostEl = el
  if (ghostEl && pending) {
    applyGhostTransform(pending.cx, pending.cy, pending.ox, pending.oy)
    pending = null
  } else if (ghostEl && lastGhost) {
    applyGhostTransform(lastGhost.cx, lastGhost.cy, lastGhost.ox, lastGhost.oy)
  }
}

/** Hot path — sync with every pointermove while dragging. */
export function syncBoardDragGhostPosition(
  clientX: number,
  clientY: number,
  offsetX: number,
  offsetY: number,
) {
  lastGhost = { cx: clientX, cy: clientY, ox: offsetX, oy: offsetY }
  if (!ghostEl) {
    pending = { cx: clientX, cy: clientY, ox: offsetX, oy: offsetY }
    return
  }
  applyGhostTransform(clientX, clientY, offsetX, offsetY)
}

export function clearBoardDragGhostPending() {
  pending = null
  lastGhost = null
}
