import { produce, type SetStoreFunction } from 'solid-js/store'
import { scheduleBoardEntityIntoView } from './boardViewportFollow'
import type { BoardPanView } from './boardPanView'

export function createBoardFollowScheduler(options: {
  getColumnEl: (columnId: string) => HTMLElement | undefined
  setView: SetStoreFunction<BoardPanView>
}) {
  let viewport: HTMLElement | undefined

  return {
    setViewport: (el: HTMLElement | undefined) => {
      viewport = el
    },
    scheduleEntity: (columnId: string, taskId?: string) => {
      scheduleBoardEntityIntoView(
        viewport,
        () => {
          if (taskId && viewport) {
            const sel = `[data-task-id="${CSS.escape(taskId)}"]`
            const hit = viewport.querySelector(sel)
            if (hit instanceof HTMLElement) return hit
          }
          return options.getColumnEl(columnId)
        },
        (dx, dy) => {
          options.setView(
            produce((v) => {
              v.x += dx
              v.y += dy
            }),
          )
        },
      )
    },
  }
}
