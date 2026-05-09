import {
  BOARD_WHEEL_COARSE_LOG_STEP,
  BOARD_WHEEL_FINE_DELTA_PX,
  BOARD_WHEEL_ZOOM_K,
  BOARD_ZOOM_MAX,
  BOARD_ZOOM_MIN,
} from './boardViewConstants'

export function clampZoomScale(s: number): number {
  return Math.min(BOARD_ZOOM_MAX, Math.max(BOARD_ZOOM_MIN, s))
}

/** Pixel deltas below this (and not line/page mode) → trackpad-style continuous zoom. */
export function isFineWheel(e: WheelEvent): boolean {
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return false
  if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return false
  return Math.abs(e.deltaY) < BOARD_WHEEL_FINE_DELTA_PX
}

/** Trackpad / fine scroll: delta-driven zoom. */
export function wheelFineTargetScale(current: number, e: WheelEvent): number {
  return clampZoomScale(current * Math.exp(-e.deltaY * BOARD_WHEEL_ZOOM_K))
}

/**
 * Mouse wheel: fixed step per tick from sign(deltaY) only — OS line multiplier
 * does not change how far one notch zooms.
 */
export function wheelCoarseTargetScale(current: number, e: WheelEvent): number {
  if (e.deltaY === 0) return current
  const ratio = Math.exp(-Math.sign(e.deltaY) * BOARD_WHEEL_COARSE_LOG_STEP)
  return clampZoomScale(current * ratio)
}
