import { batch, createEffect, createMemo, createSignal, Show } from 'solid-js'
import type { Accessor, Setter } from 'solid-js'
import { Button } from '@kobalte/core/button'
import { TextField } from '@kobalte/core/text-field'
import { Dialog } from '@kobalte/core/dialog'
import { Trash2 } from 'lucide-solid'
import { copy } from '../../lib/copy'
import { formatShortDateTime } from '../../lib/formatDate'
import { enterConfirmDelete, enterCtrlMetaSubmit, enterFocusDescription } from '../../lib/formEnter'
import {
  deleteTask,
  patchTask,
  DESCRIPTION_MAX_CHARS,
  NAME_MAX_CHARS,
  type AggregateBoardResponse,
  type TaskResponse,
} from '../../lib/api'
import { BoardDescriptionPeekClip } from './BoardDescriptionPeekClip'
import { BoardFormDialog } from './BoardFormDialog'
import { ShellExcludedDialogContent } from './ShellExcludedDialogContent'
import { DescriptionField } from './DescriptionField'
import { FieldLabelWithCount } from './FieldLabelWithCount'
import { validateEntityName, validateOptionalDescription } from '../../lib/clientValidation'
import { isClientValidationBypassed } from '../../lib/clientValidationBypass'
import { userFacingApiError } from '../../lib/apiUserMessage'
import { FormApiAlert } from './FormApiAlert'
import type { BoardDragState } from './boardDragTypes'

export function TaskRow(props: {
  boardId: string
  columnId: string
  task: TaskResponse
  setBoard: (fn: (b: AggregateBoardResponse) => void) => void
  boardDrag: () => BoardDragState
  onTaskDragPointerDown: (e: PointerEvent) => void
  onError: (err?: unknown) => void
  exclusiveEditTaskId: Accessor<string | null>
  setExclusiveEditTaskId: Setter<string | null>
}) {
  let clearDescriptionPeek: () => void = () => {}
  const taskDescTrimmed = createMemo(() => (props.task.description ?? '').trim())
  const [editOpen, setEditOpen] = createSignal(false)
  const [delOpen, setDelOpen] = createSignal(false)
  const [name, setName] = createSignal(props.task.name)
  const [desc, setDesc] = createSignal(props.task.description)
  const [taskEditErr, setTaskEditErr] = createSignal<string | null>(null)

  let taskEditNameEl: HTMLInputElement | undefined
  let taskEditDescEl: HTMLTextAreaElement | undefined
  let taskDeleteContentEl: HTMLElement | undefined

  createEffect(() => {
    if (!editOpen()) return
    queueMicrotask(() => taskEditNameEl?.focus())
  })

  /** Board-wide: only one task edit dialog; closes this row when another task claims the lease. */
  createEffect(() => {
    if (props.exclusiveEditTaskId() !== props.task.id && editOpen()) {
      batch(() => {
        setEditOpen(false)
        setTaskEditErr(null)
      })
    }
  })

  createEffect(() => {
    if (editOpen()) return
    setName(props.task.name)
    setDesc(props.task.description)
  })

  const closeEdit = () => {
    batch(() => {
      setEditOpen(false)
      setTaskEditErr(null)
      if (props.exclusiveEditTaskId() === props.task.id) {
        props.setExclusiveEditTaskId(null)
      }
    })
  }

  let lastTaskQuickTap: { t: number; x: number; y: number } | null = null
  let prevTaskBoardDrag: BoardDragState | null = null

  createEffect(() => {
    const cur = props.boardDrag()
    if (
      prevTaskBoardDrag?.phase === 'pending' &&
      prevTaskBoardDrag.kind === 'task' &&
      prevTaskBoardDrag.taskId === props.task.id &&
      !cur
    ) {
      lastTaskQuickTap = {
        t: Date.now(),
        x: prevTaskBoardDrag.originX,
        y: prevTaskBoardDrag.originY,
      }
    }
    prevTaskBoardDrag = cur
  })

  const onTaskGrabPointerDown = (e: PointerEvent) => {
    clearDescriptionPeek()
    if (e.button !== 0) return
    const now = Date.now()
    if (lastTaskQuickTap && now - lastTaskQuickTap.t < 420) {
      const dx = e.clientX - lastTaskQuickTap.x
      const dy = e.clientY - lastTaskQuickTap.y
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
            setTaskEditErr(null)
            props.setExclusiveEditTaskId(props.task.id)
            setEditOpen(true)
          }
          lastTaskQuickTap = { t: Date.now(), x: ev.clientX, y: ev.clientY }
        }
        el.addEventListener('pointerup', finish)
        el.addEventListener('pointercancel', finish)
        e.preventDefault()
        return
      }
    }
    props.onTaskDragPointerDown(e)
  }

  const save = async () => {
    if (!isClientValidationBypassed()) {
      const vn = validateEntityName(name())
      if (vn) {
        setTaskEditErr(vn)
        return
      }
      const vd = validateOptionalDescription(desc())
      if (vd) {
        setTaskEditErr(vd)
        return
      }
    }
    setTaskEditErr(null)
    const pn = props.task.name
    const pd = props.task.description
    const nm = name().trim()
    const ds = desc().trim()
    props.setBoard((b) => {
      const col = b.columns.find((c) => c.id === props.columnId)
      const t = col?.tasks.find((x) => x.id === props.task.id)
      if (t) {
        t.name = nm
        t.description = ds
      }
    })
    closeEdit()
    try {
      const { data } = await patchTask(props.boardId, props.columnId, props.task.id, { name: nm, description: ds })
      props.setBoard((b) => {
        const col = b.columns.find((c) => c.id === props.columnId)
        const t = col?.tasks.find((x) => x.id === props.task.id)
        if (t) {
          t.name = data.name
          t.description = data.description
          t.updatedAt = data.updatedAt
        }
      })
    } catch (e) {
      props.setBoard((b) => {
        const col = b.columns.find((c) => c.id === props.columnId)
        const t = col?.tasks.find((x) => x.id === props.task.id)
        if (t) {
          t.name = pn
          t.description = pd
        }
      })
      const msg = userFacingApiError(e)
      queueMicrotask(() => {
        props.setExclusiveEditTaskId(props.task.id)
        setName(nm)
        setDesc(ds)
        setEditOpen(true)
        setTaskEditErr(msg)
      })
    }
  }

  const remove = async () => {
    let prev: TaskResponse[] = []
    props.setBoard((b) => {
      const col = b.columns.find((c) => c.id === props.columnId)
      if (col) {
        prev = col.tasks.map((t) => ({ ...t }))
        col.tasks = col.tasks.filter((t) => t.id !== props.task.id)
      }
    })
    setDelOpen(false)
    try {
      await deleteTask(props.boardId, props.columnId, props.task.id)
    } catch (e) {
      props.setBoard((b) => {
        const col = b.columns.find((c) => c.id === props.columnId)
        if (col) col.tasks = prev
      })
      props.onError(e)
    }
  }

  const taskDraggingDim = createMemo(() => {
    const d = props.boardDrag()
    return !!(d?.phase === 'dragging' && d.kind === 'task' && d.taskId === props.task.id)
  })

  return (
    <>
      <div
        data-task-id={props.task.id}
        data-board-interactive=""
        class="group/task relative overflow-hidden rounded-[var(--radius-control)] border border-border bg-bg-muted/50 transition-[colors,opacity] duration-150 [contain:layout] hover:border-accent/30"
        classList={{
          'opacity-35': taskDraggingDim(),
        }}
      >
        <div
          class={`kb-focus-ring touch-none cursor-grab select-none rounded-t-[var(--radius-control)] pr-10 active:cursor-grabbing ${
            taskDescTrimmed()
              ? 'min-h-[4.5rem] px-3 pt-2 pb-0'
              : 'min-h-[2.25rem] px-3 py-1.5'
          }`}
          onPointerDown={onTaskGrabPointerDown}
        >
          <div class="mt-0 min-w-0 pr-9 font-medium leading-tight text-fg">{props.task.name}</div>
          <BoardDescriptionPeekClip
            variant="task"
            refreshKey={() => `${props.task.id}\0${props.task.description ?? ''}`}
            hasDescription={() => !!taskDescTrimmed()}
            description={() => props.task.description}
            collapsePeekWhen={() => {
              const d = props.boardDrag()
              return !!(d?.phase === 'dragging' && d.kind === 'task' && d.taskId === props.task.id)
            }}
            bindPeekClear={(c) => {
              clearDescriptionPeek = c
            }}
          />
        </div>
        <div class="border-t border-border/35 px-3 pb-2 pt-1.5 text-[10px] leading-snug text-fg-muted/85">
          <span class="tabular-nums" title={props.task.createdAt}>
            {copy.taskCreated} {formatShortDateTime(props.task.createdAt)}
          </span>
          <span class="mx-1.5 text-fg-muted/40">·</span>
          <span class="tabular-nums" title={props.task.updatedAt}>
            {copy.taskUpdated} {formatShortDateTime(props.task.updatedAt)}
          </span>
        </div>
        <div class="absolute right-2 top-2 opacity-0 transition group-hover/task:opacity-100">
          <button
            type="button"
            class="kb-focus-ring flex size-7 items-center justify-center rounded-[var(--radius-control)] border border-border bg-bg text-danger hover:bg-bg-elevated"
            aria-label={copy.deleteTask}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setDelOpen(true)}
          >
            <Trash2 class="size-[0.65625rem]" />
          </button>
        </div>
      </div>

      <BoardFormDialog
        title={copy.editTask}
        open={editOpen()}
        onOpenChange={(open) => {
          if (open) {
            setEditOpen(true)
          } else {
            closeEdit()
          }
        }}
      >
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1">
            <TextField.Label class="block w-full">
              <FieldLabelWithCount label={copy.taskName} length={name().length} max={NAME_MAX_CHARS} />
            </TextField.Label>
            <TextField.Input
              ref={(el) => (taskEditNameEl = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              value={name()}
              maxLength={isClientValidationBypassed() ? undefined : NAME_MAX_CHARS}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => taskEditDescEl)}
            />
          </TextField>
          <DescriptionField
            label={copy.taskDescription}
            value={desc}
            onInput={setDesc}
            maxLength={isClientValidationBypassed() ? undefined : DESCRIPTION_MAX_CHARS}
            charCountMax={DESCRIPTION_MAX_CHARS}
            ref={(el) => (taskEditDescEl = el)}
            onKeyDown={enterCtrlMetaSubmit(save)}
          />
          <Show when={taskEditErr()}>
            <FormApiAlert message={taskEditErr()!} />
          </Show>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => closeEdit()}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void save()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>

      <Dialog open={delOpen()} onOpenChange={setDelOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-40 bg-black/60" />
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <ShellExcludedDialogContent
              ref={(el) => {
                taskDeleteContentEl = el
              }}
              class="w-full max-w-2xl rounded-[var(--radius-card)] border border-border bg-bg-elevated p-6 shadow-card"
              tabIndex={-1}
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                queueMicrotask(() => taskDeleteContentEl?.focus())
              }}
              onKeyDown={enterConfirmDelete(remove)}
            >
              <Dialog.Title class="text-lg font-semibold">{copy.deleteTask}</Dialog.Title>
              <p class="mt-2 text-sm text-fg-muted">{copy.deleteTaskConfirm}</p>
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
                  onClick={() => void remove()}
                >
                  {copy.delete}
                </Button>
              </div>
            </ShellExcludedDialogContent>
          </div>
        </Dialog.Portal>
      </Dialog>
    </>
  )
}
