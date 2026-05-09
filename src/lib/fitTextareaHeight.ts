/** Collapse then expand to scrollHeight — avoids autosize “running ahead” of content. */
export function fitTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = '0px'
  el.style.overflow = 'hidden'
  el.style.height = `${el.scrollHeight}px`
}
