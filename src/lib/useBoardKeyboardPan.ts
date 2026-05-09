import { onMount } from 'solid-js'
import { produce, type SetStoreFunction } from 'solid-js/store'
import type { AggregateBoardResponse } from './api'
import { BOARD_KEY_PAN_PX } from './boardViewConstants'
import type { BoardPanView } from './boardPanView'

export function useBoardKeyboardPan(options: {
  getBoard: () => AggregateBoardResponse | null
  setView: SetStoreFunction<BoardPanView>
}) {
  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!options.getBoard()) return
      e.preventDefault()
      const dx = e.key === 'ArrowLeft' ? BOARD_KEY_PAN_PX : -BOARD_KEY_PAN_PX
      options.setView(
        produce((v) => {
          v.x += dx
        }),
      )
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
}
