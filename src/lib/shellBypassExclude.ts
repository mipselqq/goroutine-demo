import { createSignal } from 'solid-js'

/** Portal strip that holds “Bypass client validation” — excluded from modal outside-dismiss. */
export const [shellBypassExcludeEl, setShellBypassExcludeEl] = createSignal<HTMLElement | undefined>()
