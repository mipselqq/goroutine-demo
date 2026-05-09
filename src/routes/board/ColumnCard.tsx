import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { Button } from '@kobalte/core/button'
import { TextField } from '@kobalte/core/text-field'
import { Dialog } from '@kobalte/core/dialog'
import { Plus, Trash2 } from 'lucide-solid'
import { copy, formatTaskColumnCount } from '../../lib/copy'
import { enterConfirmDelete, enterCtrlMetaSubmit, enterFocusDescription } from '../../lib/formEnter'
import {
  createTask,
  deleteColumn,
  patchColumn,
  POSITION_BASE,
  DESCRIPTION_MAX_CHARS,
  NAME_MAX_CHARS,
  type AggregateBoardResponse,
  type AggregateColumnResponse,
  type TaskResponse,
} from '../../lib/api'
import { cloneBoard } from '../../lib/optimistic'
import { taskDropLineBeforeFullIndex } from '../../lib/boardPointerDnD'
import { createDescriptionPeek, DESCRIPTION_DESC_CLOSE, DESCRIPTION_DESC_OPEN } from '../../lib/descPeek'
import { createDescPeekNeedsFade } from '../../lib/descPeekOverflow'
import { BoardFormDialog } from './BoardFormDialog'
import { DescriptionField } from './DescriptionField'
import { FieldLabelWithCount } from './FieldLabelWithCount'
import type { BoardDragPayload, BoardDragState } from './boardDragTypes'
import { TaskRow } from './TaskRow'
import { BOARD_DESCRIPTION_TEXT_CLASS } from '../../lib/boardViewConstants'
import { validateEntityName, validateOptionalDescription } from '../../lib/clientValidation'
import { isClientValidationBypassed } from '../../lib/clientValidationBypass'
import { userFacingApiError } from '../../lib/apiUserMessage'
import { FormApiAlert } from './FormApiAlert'

export function ColumnCard(props: {
  boardId: string
  column: AggregateColumnResponse
  setBoard: (fn: (b: AggregateBoardResponse) => void) => void
  setColumnEl: (columnId: string, el: HTMLElement | undefined) => void
  setTaskAreaEl: (columnId: string, el: HTMLElement | undefined) => void
  boardDrag: () => BoardDragState
  startBoardDrag: (e: PointerEvent, payload: BoardDragPayload) => void
  onBoardError: (err?: unknown) => void
}) {
  const colDesc = createDescriptionPeek()
  const [colDescFade, attachColDescClip] = createDescPeekNeedsFade({
    peek: colDesc.peek,
    refresh: () => `${props.column.id}\0${props.column.description ?? ''}`,
  })
  const columnDescTrimmed = createMemo(() => (props.column.description ?? '').trim())
  const [editOpen, setEditOpen] = createSignal(false)
  const [delOpen, setDelOpen] = createSignal(false)
  const [newTaskOpen, setNewTaskOpen] = createSignal(false)
  const [newTaskName, setNewTaskName] = createSignal('')
  const [newTaskDesc, setNewTaskDesc] = createSignal('')
  const [newTaskErr, setNewTaskErr] = createSignal<string | null>(null)
  const [colEditErr, setColEditErr] = createSignal<string | null>(null)
  const [name, setName] = createSignal(props.column.name)
  const [desc, setDesc] = createSignal(props.column.description)

  let colEditNameEl: HTMLInputElement | undefined
  let colEditDescEl: HTMLTextAreaElement | undefined
  let newTaskNameEl: HTMLInputElement | undefined
  let newTaskDescEl: HTMLTextAreaElement | undefined
  let colDeleteContentEl: HTMLElement | undefined

  createEffect(() => {
    if (!editOpen()) return
    queueMicrotask(() => colEditNameEl?.focus())
  })

  createEffect(() => {
    if (!newTaskOpen()) return
    queueMicrotask(() => newTaskNameEl?.focus())
  })

  createEffect(() => {
    setName(props.column.name)
    setDesc(props.column.description)
  })

  let lastColQuickTap: { t: number; x: number; y: number } | null = null
  let prevColBoardDrag: BoardDragState | null = null

  createEffect(() => {
    const cur = props.boardDrag()
    if (
      prevColBoardDrag?.phase === 'pending' &&
      prevColBoardDrag.kind === 'column' &&
      prevColBoardDrag.columnId === props.column.id &&
      !cur
    ) {
      lastColQuickTap = {
        t: Date.now(),
        x: prevColBoardDrag.originX,
        y: prevColBoardDrag.originY,
      }
    }
    prevColBoardDrag = cur
  })

  createEffect(() => {
    const d = props.boardDrag()
    if (d?.phase === 'dragging' && d.kind === 'column' && d.columnId === props.column.id) {
      colDesc.clear()
    }
  })

  const onColumnGrabPointerDown = (e: PointerEvent) => {
    colDesc.clear()
    if (e.button !== 0) return
    const now = Date.now()
    if (lastColQuickTap && now - lastColQuickTap.t < 420) {
      const dx = e.clientX - lastColQuickTap.x
      const dy = e.clientY - lastColQuickTap.y
      if (dx * dx + dy * dy < 40 * 40) {
        const el = e.currentTarget as HTMLElement
        const ox = e.clientX
        const oy = e.clientY
        const pid = e.pointerId
        const finish = (ev: PointerEvent) => {
          if (ev.pointerId !== pid) return
          el.removeEventListener('pointerup', finish)
          el.removeEventListener('pointercancel', finish)
          const ddx = ev.clientX - ox
          const ddy = ev.clientY - oy
          if (ddx * ddx + ddy * ddy < 12 * 12) {
            setEditOpen(true)
            setColEditErr(null)
          }
          lastColQuickTap = { t: Date.now(), x: ev.clientX, y: ev.clientY }
        }
        el.addEventListener('pointerup', finish)
        el.addEventListener('pointercancel', finish)
        e.preventDefault()
        return
      }
    }
    props.startBoardDrag(e, {
      kind: 'column',
      columnId: props.column.id,
      title: props.column.name,
      sub: props.column.description,
    })
  }

  const saveCol = async () => {
    if (!isClientValidationBypassed()) {
      const vn = validateEntityName(name())
      if (vn) {
        setColEditErr(vn)
        return
      }
      const vd = validateOptionalDescription(desc())
      if (vd) {
        setColEditErr(vd)
        return
      }
    }
    setColEditErr(null)
    const prevName = props.column.name
    const prevDesc = props.column.description
    const nm = name().trim()
    const ds = desc().trim()
    props.setBoard((b) => {
      const c = b.columns.find((x) => x.id === props.column.id)
      if (c) {
        c.name = nm
        c.description = ds
      }
    })
    setEditOpen(false)
    try {
      await patchColumn(props.boardId, props.column.id, { name: nm, description: ds })
    } catch (e) {
      props.setBoard((b) => {
        const c = b.columns.find((x) => x.id === props.column.id)
        if (c) {
          c.name = prevName
          c.description = prevDesc
        }
      })
      const msg = userFacingApiError(e)
      queueMicrotask(() => {
        setName(nm)
        setDesc(ds)
        setEditOpen(true)
        setColEditErr(msg)
      })
    }
  }

  const removeCol = async () => {
    let snapshot: AggregateBoardResponse | null = null
    props.setBoard((b) => {
      snapshot = cloneBoard(b)
      b.columns = b.columns.filter((c) => c.id !== props.column.id)
    })
    setDelOpen(false)
    try {
      await deleteColumn(props.boardId, props.column.id)
    } catch (e) {
      if (snapshot) {
        props.setBoard((b) => {
          b.columns = snapshot!.columns.map((c) => ({
            ...c,
            tasks: c.tasks.map((t) => ({ ...t })),
          }))
        })
      }
      props.onBoardError(e)
    }
  }

  const submitNewTask = async () => {
    if (!isClientValidationBypassed()) {
      const vn = validateEntityName(newTaskName())
      if (vn) {
        setNewTaskErr(vn)
        return
      }
      const vd = validateOptionalDescription(newTaskDesc())
      if (vd) {
        setNewTaskErr(vd)
        return
      }
    }
    setNewTaskErr(null)
    const tname = newTaskName().trim()
    const tdesc = newTaskDesc().trim()
    const tid = `optim-${crypto.randomUUID()}`
    const optimistic: TaskResponse = {
      id: tid,
      columnId: props.column.id,
      name: tname,
      description: tdesc,
      position: props.column.tasks.length + POSITION_BASE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    props.setBoard((b) => {
      const c = b.columns.find((x) => x.id === props.column.id)
      if (c) c.tasks = [...c.tasks, optimistic]
    })
    setNewTaskOpen(false)
    setNewTaskName('')
    setNewTaskDesc('')
    try {
      const { data } = await createTask(props.boardId, props.column.id, {
        name: tname,
        description: tdesc,
      })
      props.setBoard((b) => {
        const c = b.columns.find((x) => x.id === props.column.id)
        if (c) c.tasks = c.tasks.map((t) => (t.id === tid ? data : t))
      })
    } catch (e) {
      props.setBoard((b) => {
        const c = b.columns.find((x) => x.id === props.column.id)
        if (c) c.tasks = c.tasks.filter((t) => t.id !== tid)
      })
      setNewTaskName(tname)
      setNewTaskDesc(tdesc)
      setNewTaskOpen(true)
      setNewTaskErr(userFacingApiError(e))
    }
  }

  const activeTaskDrop = createMemo(() => {
    const d = props.boardDrag()
    if (!d || d.phase !== 'dragging' || d.kind !== 'task') return null
    const td = d.taskDrop
    if (!td || td.columnId !== props.column.id) return null
    return { d, td }
  })

  const colDraggingDim = createMemo(() => {
    const d = props.boardDrag()
    return !!(d?.phase === 'dragging' && d.kind === 'column' && d.columnId === props.column.id)
  })

  const colTaskDropHighlight = createMemo(() => activeTaskDrop() !== null)

  const emptyTaskDropBar = () => {
    const x = activeTaskDrop()
    if (!x || props.column.tasks.length !== 0) return false
    return taskDropLineBeforeFullIndex(x.td, x.d.sourceColumnId, x.d.taskId, props.column.tasks) === 0
  }

  const taskDropBarBefore = (taskIndex: number) => {
    const x = activeTaskDrop()
    if (!x) return false
    return taskDropLineBeforeFullIndex(x.td, x.d.sourceColumnId, x.d.taskId, props.column.tasks) === taskIndex
  }

  const taskDropBarAfterTasks = () => {
    const x = activeTaskDrop()
    const n = props.column.tasks.length
    if (!x || n === 0) return false
    return taskDropLineBeforeFullIndex(x.td, x.d.sourceColumnId, x.d.taskId, props.column.tasks) === n
  }

  return (
    <div
      ref={(el) => {
        props.setColumnEl(props.column.id, el)
        onCleanup(() => props.setColumnEl(props.column.id, undefined))
      }}
      class="group flex w-80 shrink-0 flex-col overflow-visible rounded-[var(--radius-card)] border border-border bg-bg-elevated shadow-[0_4px_14px_rgb(0_0_0/0.26)] [contain:layout]"
      classList={{
        'opacity-40': colDraggingDim(),
        'ring-2 ring-accent/45 ring-offset-2 ring-offset-bg-elevated': colTaskDropHighlight(),
      }}
      data-board-interactive=""
    >
      <div
        class={`flex flex-col gap-1 border-b border-border px-4 ${columnDescTrimmed() ? 'py-3' : 'py-1.5'}`}
      >
        <div class="flex items-start justify-between gap-2">
          <div
            class="kb-focus-ring min-w-0 flex-1 touch-none cursor-grab select-none rounded-sm py-0.5 active:cursor-grabbing"
            onPointerDown={onColumnGrabPointerDown}
          >
            <h2 class="truncate text-lg font-semibold leading-tight text-fg">{props.column.name}</h2>
            <p class="mt-0.5 text-[11px] font-medium tabular-nums text-fg-muted/90">
              {formatTaskColumnCount(props.column.tasks.length)}
            </p>
            <div
              ref={(el) => attachColDescClip(el ?? undefined)}
              class={`relative overflow-hidden leading-tight [overflow-wrap:anywhere] ${BOARD_DESCRIPTION_TEXT_CLASS} ${
                columnDescTrimmed() ? 'mt-2' : 'mt-1'
              } ${
                colDesc.peek() && columnDescTrimmed()
                  ? 'scrollbar-none max-h-[min(70vh,28rem)] overflow-y-auto'
                  : columnDescTrimmed()
                    ? 'max-h-[2.7rem] min-h-[2.1rem]'
                    : 'max-h-[1.35rem] min-h-[1.05rem]'
              }`}
              style={{ transition: colDesc.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
              onPointerEnter={() => {
                if (!columnDescTrimmed()) return
                colDesc.schedule()
              }}
              onPointerLeave={() => {
                if (!columnDescTrimmed()) return
                colDesc.clear()
              }}
            >
              <Show
                when={columnDescTrimmed()}
                fallback={
                  <p
                    class={`relative z-0 whitespace-pre-wrap break-words ${
                      columnDescTrimmed() ? 'min-h-[2.1rem]' : 'min-h-[1.05rem]'
                    }`}
                  >
                    <span class="select-none text-fg/[0.2]">{copy.noDescription}</span>
                  </p>
                }
              >
                <>
                  <p class="relative z-0 whitespace-pre-wrap break-words text-fg-muted">{props.column.description}</p>
                  <Show when={colDescFade()}>
                    <div
                      class={`peek-desc-fade peek-desc-fade--elevated absolute inset-x-0 bottom-0 z-[1] ${
                        colDesc.peek() ? 'opacity-0' : 'opacity-100'
                      }`}
                      style={{ transition: colDesc.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
                      aria-hidden="true"
                    />
                  </Show>
                </>
              </Show>
            </div>
          </div>
          <div class="flex shrink-0 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              data-board-interactive=""
              class="kb-focus-ring flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-border bg-bg-muted text-danger hover:bg-bg"
              aria-label={copy.deleteColumn}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setDelOpen(true)}
            >
              <Trash2 class="size-3" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={(el) => {
          props.setTaskAreaEl(props.column.id, el)
          onCleanup(() => props.setTaskAreaEl(props.column.id, undefined))
        }}
        class="flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto p-3"
        data-board-interactive=""
      >
        <Show when={emptyTaskDropBar()}>
          <div
            class="pointer-events-none h-1 w-full shrink-0 rounded-full bg-accent shadow-[0_0_8px] shadow-accent/50"
            aria-hidden="true"
          />
        </Show>
        <For each={props.column.tasks}>
          {(task, i) => (
            <>
              <Show when={taskDropBarBefore(i())}>
                <div
                  class="pointer-events-none h-1 w-full shrink-0 rounded-full bg-accent shadow-[0_0_8px] shadow-accent/50"
                  aria-hidden="true"
                />
              </Show>
              <TaskRow
                boardId={props.boardId}
                columnId={props.column.id}
                task={task}
                setBoard={props.setBoard}
                boardDrag={props.boardDrag}
                onTaskDragPointerDown={(e) =>
                  props.startBoardDrag(e, {
                    kind: 'task',
                    sourceColumnId: props.column.id,
                    taskId: task.id,
                    title: task.name,
                    sub: task.description,
                  })
                }
                onError={props.onBoardError}
              />
            </>
          )}
        </For>
        <Show when={taskDropBarAfterTasks()}>
          <div
            class="pointer-events-none h-1 w-full shrink-0 rounded-full bg-accent shadow-[0_0_8px] shadow-accent/50"
            aria-hidden="true"
          />
        </Show>
        <button
          type="button"
          data-board-interactive=""
          class="kb-focus-ring flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-dashed border-border bg-bg-muted/40 text-sm text-fg-muted hover:border-accent/40 hover:bg-bg-muted/60 hover:text-fg"
          onClick={() => {
            setNewTaskName('')
            setNewTaskDesc('')
            setNewTaskErr(null)
            setNewTaskOpen(true)
          }}
        >
          <Plus class="size-5" />
          {copy.addTask}
        </button>
      </div>

      <BoardFormDialog title={copy.createTaskTitle} open={newTaskOpen()} onOpenChange={(open) => {
          setNewTaskOpen(open)
          if (!open) {
            setNewTaskName('')
            setNewTaskDesc('')
            setNewTaskErr(null)
          }
        }}>
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1">
            <TextField.Label class="block w-full">
              <FieldLabelWithCount label={copy.taskName} length={newTaskName().length} max={NAME_MAX_CHARS} />
            </TextField.Label>
            <TextField.Input
              ref={(el) => (newTaskNameEl = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              placeholder={copy.newTaskName}
              value={newTaskName()}
              maxLength={isClientValidationBypassed() ? undefined : NAME_MAX_CHARS}
              onInput={(e) => setNewTaskName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => newTaskDescEl)}
            />
          </TextField>
          <DescriptionField
            label={copy.taskDescription}
            value={newTaskDesc}
            onInput={setNewTaskDesc}
            maxLength={isClientValidationBypassed() ? undefined : DESCRIPTION_MAX_CHARS}
            charCountMax={DESCRIPTION_MAX_CHARS}
            placeholder={copy.newTaskDescription}
            ref={(el) => (newTaskDescEl = el)}
            onKeyDown={enterCtrlMetaSubmit(submitNewTask)}
          />
          <Show when={newTaskErr()}>
            <FormApiAlert message={newTaskErr()!} />
          </Show>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setNewTaskOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void submitNewTask()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>

      <BoardFormDialog
        title={copy.editColumn}
        open={editOpen()}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setColEditErr(null)
        }}
      >
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1">
            <TextField.Label class="block w-full">
              <FieldLabelWithCount label={copy.columnName} length={name().length} max={NAME_MAX_CHARS} />
            </TextField.Label>
            <TextField.Input
              ref={(el) => (colEditNameEl = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              value={name()}
              maxLength={isClientValidationBypassed() ? undefined : NAME_MAX_CHARS}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => colEditDescEl)}
            />
          </TextField>
          <DescriptionField
            label={copy.columnDescription}
            value={desc}
            onInput={setDesc}
            maxLength={isClientValidationBypassed() ? undefined : DESCRIPTION_MAX_CHARS}
            charCountMax={DESCRIPTION_MAX_CHARS}
            ref={(el) => (colEditDescEl = el)}
            onKeyDown={enterCtrlMetaSubmit(saveCol)}
          />
          <Show when={colEditErr()}>
            <FormApiAlert message={colEditErr()!} />
          </Show>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setEditOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void saveCol()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>

      <Dialog open={delOpen()} onOpenChange={setDelOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-40 bg-black/60" />
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content
              ref={(el) => {
                colDeleteContentEl = el
              }}
              class="w-full max-w-2xl rounded-[var(--radius-card)] border border-border bg-bg-elevated p-6 shadow-card"
              tabIndex={-1}
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                queueMicrotask(() => colDeleteContentEl?.focus())
              }}
              onKeyDown={enterConfirmDelete(removeCol)}
            >
              <Dialog.Title class="text-lg font-semibold">{copy.deleteColumn}</Dialog.Title>
              <p class="mt-2 text-sm text-fg-muted">{copy.deleteColumnConfirm}</p>
              <div class="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  class="rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
                  onClick={() => setDelOpen(false)}
                >
                  {copy.cancel}
                </Button>
                <Button
                  type="button"
                  class="rounded-[var(--radius-control)] bg-danger px-4 py-2 text-sm font-medium text-white"
                  onClick={() => void removeCol()}
                >
                  {copy.delete}
                </Button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </div>
  )
}
