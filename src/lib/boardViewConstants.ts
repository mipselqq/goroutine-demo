import type { BoardPanView } from './boardPanView'

/** Inline description body (task/column/board): ~15% larger than Tailwind `text-xs` (0.75rem). */
export const BOARD_DESCRIPTION_TEXT_CLASS = 'text-[0.8625rem]'

/** Initial pan/zoom on board page load — must match loading skeleton transform. */
export const BOARD_PAGE_INITIAL_VIEW: BoardPanView = { x: 80, y: 48, scale: 1 }

/** Min / max board canvas scale (CSS transform). Further zoom-out: 1.3× beyond old ~0.35 floor. */
export const BOARD_ZOOM_MIN = 0.35 / 1.3
export const BOARD_ZOOM_MAX = 1.85

/** Screen-space pan per arrow key; 20% above a 120px baseline. */
export const BOARD_KEY_PAN_PX = 120 * 1.2

/** Fine scroll: exp(-deltaY * K); higher = faster zoom per pixel of delta. */
export const BOARD_WHEEL_ZOOM_K = 0.0045

/** Coarse wheel: fixed log-step per notch (sign only); higher = more zoom per tick. */
export const BOARD_WHEEL_COARSE_LOG_STEP = 0.24

/** Pixel-mode wheels with |deltaY| below this are treated as trackpad (fine path). */
export const BOARD_WHEEL_FINE_DELTA_PX = 52

/**
 * Per animation frame: move current scale toward target with this factor (0–1).
 * Higher = snappier; same smoothing for wheel + trackpad.
 */
export const BOARD_WHEEL_SMOOTH_ALPHA = 0.62

/** When |target − current| scale is below this, approach uses a slower alpha (final settle). */
export const BOARD_WHEEL_FINAL_SLOW_DISTANCE = 0.038

/** Final-phase alpha multiplier vs BOARD_WHEEL_SMOOTH_ALPHA (~1.5× longer settling). */
export const BOARD_WHEEL_FINAL_SLOW_FACTOR = 1 / 1.5

/** Initial pan/zoom when starting stress populate “cinema”. */
export const BOARD_POPULATE_CINEMA_VIEW: BoardPanView = { x: 56, y: 36, scale: 0.36 }
