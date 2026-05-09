/** Enter: name field → focus description (no Ctrl/Meta/Shift/Alt). */
export function enterFocusDescription(
  getDesc: () => HTMLInputElement | HTMLTextAreaElement | undefined,
) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    getDesc()?.focus()
  }
}

/** Enter in description: run submit (no Ctrl/Meta/Shift/Alt). */
export function enterSubmit(fn: () => void | Promise<void>) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    void fn()
  }
}

/** Ctrl+Enter / Cmd+Enter in multiline description: submit. */
export function enterCtrlMetaSubmit(fn: () => void | Promise<void>) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || (!e.ctrlKey && !e.metaKey) || e.altKey) return
    e.preventDefault()
    void fn()
  }
}

/**
 * In delete dialogs: Enter confirms destructive action when focus is not on a
 * button (buttons keep native Enter) or on text fields.
 */
export function enterConfirmDelete(fn: () => void | Promise<void>) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t instanceof HTMLButtonElement) return
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement)
      return
    e.preventDefault()
    void fn()
  }
}
