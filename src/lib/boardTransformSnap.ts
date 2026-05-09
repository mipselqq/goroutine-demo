/**
 * Quantize CSS pan/zoom for display so glyphs don't hunt between subpixel positions
 * while devicePixelRatio scaling animates.
 */
export function snapPanZoomForPaint(x: number, y: number, scale: number): {
  x: number
  y: number
  scale: number
} {
  const dpr =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1
  const snapPx = (v: number) => Math.round(v * dpr) / dpr
  const scaleQ = Math.round(scale * 1e6) / 1e6
  return { x: snapPx(x), y: snapPx(y), scale: scaleQ }
}
