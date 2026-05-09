/** Resolved CSS max-height in px, or +Infinity if none / unparsable. */
function readMaxHeightPx(el: HTMLElement): number {
  const raw = getComputedStyle(el).maxHeight
  if (!raw || raw === 'none') return Infinity
  const px = parseFloat(raw)
  return Number.isFinite(px) ? px : Infinity
}

/** Collapse then expand to scrollHeight — avoids autosize “running ahead” of content.
 * If `max-height` is set on the element, height never exceeds it and `overflow` becomes `auto` when needed. */
export function fitTextareaHeight(el: HTMLTextAreaElement) {
  const maxPx = readMaxHeightPx(el)

  el.style.height = '0px'
  el.style.overflow = 'hidden'
  const natural = el.scrollHeight
  const next = Number.isFinite(maxPx) ? Math.min(natural, maxPx) : natural
  el.style.height = `${next}px`
  el.style.overflow = natural > next ? 'auto' : 'hidden'
}
