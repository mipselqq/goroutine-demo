import { createEffect, createSignal, type Accessor } from 'solid-js'
import { produce, type SetStoreFunction } from 'solid-js/store'
import { type AggregateBoardResponse } from './api'
import { mergeCreatedColumnIntoBoard, mergeCreatedTaskIntoBoard } from './boardAggregateMerge'
import { BOARD_POPULATE_CINEMA_VIEW } from './boardViewConstants'
import type { BoardPanView } from './boardPanView'
import { userFacingApiError } from './apiUserMessage'
import {
  consumePopulateStressSpec,
  runPopulateStressBoardLive,
  type PopulateStressProgress,
} from './populateStressBoard'

type BoardPageStore = {
  board: AggregateBoardResponse | null
  loadError: string | null
}

export function useBoardPopulateCinema(options: {
  getSearch: Accessor<string>
  getBoardId: Accessor<string>
  getBoard: Accessor<AggregateBoardResponse | null>
  navigate: (to: string, navOpts?: { replace?: boolean }) => void
  setStore: SetStoreFunction<BoardPageStore>
  setView: SetStoreFunction<BoardPanView>
  scheduleFollow: (columnId: string, taskId?: string) => void
}) {
  const [populateLive, setPopulateLive] = createSignal<PopulateStressProgress | null>(null)

  createEffect(() => {
    options.getSearch()
    const id = options.getBoardId()
    const b = options.getBoard()

    if (new URLSearchParams(options.getSearch()).get('populate') !== '1') return
    if (!b || b.id !== id) return

    const spec = consumePopulateStressSpec(id)
    options.navigate(`/boards/${id}`, { replace: true })

    if (!spec) return

    options.setView({ ...BOARD_POPULATE_CINEMA_VIEW })

    void (async () => {
      try {
        await runPopulateStressBoardLive(
          id,
          { colCount: spec.colCount, taskCounts: spec.taskCounts },
          {
            onProgress: (p) => setPopulateLive(p),
            onColumn: (col) => {
              options.setStore(
                'board',
                produce((draft) => {
                  mergeCreatedColumnIntoBoard(draft, id, col)
                }),
              )
              options.scheduleFollow(col.id)
            },
            onTask: (task) => {
              options.setStore(
                'board',
                produce((draft) => {
                  mergeCreatedTaskIntoBoard(draft, id, task)
                }),
              )
              options.scheduleFollow(task.columnId, task.id)
            },
          },
        )
      } catch (e) {
        options.setStore('loadError', userFacingApiError(e))
      } finally {
        setPopulateLive(null)
      }
    })()
  })

  return populateLive
}
