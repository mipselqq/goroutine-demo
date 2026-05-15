import { onMount } from 'solid-js'
import { produce, type SetStoreFunction } from 'solid-js/store'
import type { AggregateBoardResponse } from './api'
import { BOARD_KEY_PAN_PX, BOARD_KEY_PAN_Y_PX } from './boardViewConstants'
import type { BoardPanView } from './boardPanView'

export function useBoardKeyboardPan(options: {
  getBoard: () => AggregateBoardResponse | null
  setView: SetStoreFunction<BoardPanView>
}) {
  let cachedDx: number | null = null
  let cachedDy: number | null = null

  onMount(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (!options.getBoard()) return
      e.preventDefault()
      
      options.setView(
        produce((v) => {
          if (cachedDx === null) {
            const cols = Array.from(document.querySelectorAll<HTMLElement>('.w-80.shrink-0'))
            if (cols.length >= 2) {
              // Subtract 1px to avoid slightly overshooting due to borders/rounding
              cachedDx = cols[1].offsetLeft - cols[0].offsetLeft - 1
            }
          }
          const dx = cachedDx ?? BOARD_KEY_PAN_PX

          if (cachedDy === null) {
            const tasks = Array.from(document.querySelectorAll<HTMLElement>('.group\\/task'))
            for (const t of tasks) {
              const parent = t.parentElement
              if (parent) {
                const siblings = Array.from(parent.querySelectorAll<HTMLElement>('.group\\/task'))
                if (siblings.length >= 2) {
                  // Subtract 1px from the single step, then multiply for the double jump
                  cachedDy = (siblings[1].offsetTop - siblings[0].offsetTop - 1) * 2
                  break
                }
              }
            }
          }
          const dy = cachedDy ?? BOARD_KEY_PAN_Y_PX

          if (e.key === 'ArrowLeft') v.x += dx * v.scale
          if (e.key === 'ArrowRight') v.x -= dx * v.scale
          if (e.key === 'ArrowUp') v.y += dy * v.scale
          if (e.key === 'ArrowDown') v.y -= dy * v.scale
        }),
      )
    }

    const clearCache = () => {
      cachedDx = null
      cachedDy = null
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', clearCache)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', clearCache)
    }
  })
}
