import { createEffect, createResource, createSignal, For, Show } from 'solid-js'
import type { Accessor } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { enterConfirmDelete, enterCtrlMetaSubmit, enterFocusDescription } from '../lib/formEnter'
import { Button } from '@kobalte/core/button'
import { TextField } from '@kobalte/core/text-field'
import { Dialog } from '@kobalte/core/dialog'
import { Pencil, Trash2 } from 'lucide-solid'
import { copy, formatBoardCompactStats } from '../lib/copy'
import { formatShortDateTime } from '../lib/formatDate'
import { getCachedBoardCounts, setCachedBoardCounts } from '../lib/boardCountCache'
import { BOARD_DESCRIPTION_TEXT_CLASS } from '../lib/boardViewConstants'
import { createDelayedSkeletonShow, SKELETON_FADE_MS } from '../lib/delayedSkeleton'
import {
  ApiError,
  createBoard,
  deleteBoard,
  DESCRIPTION_MAX_CHARS,
  getBoardAggregate,
  listBoards,
  patchBoard,
  type BoardResponse,
} from '../lib/api'
import {
  createStressBoardAndSpec,
  type PopulateStressProgress,
  writePopulateStressSpec,
} from '../lib/populateStressBoard'
import {
  copyBoardExportToClipboard,
  parseBoardExportJson,
  runImportBoardLive,
  serializeBoardToExport,
  type BoardExportV1,
} from '../lib/boardExportImport'
import {
  createDescriptionPeek,
  DESCRIPTION_DESC_CLOSE,
  DESCRIPTION_DESC_OPEN,
} from '../lib/descPeek'
import { createDescPeekNeedsFade } from '../lib/descPeekOverflow'
import { BoardFormDialog } from './board/BoardFormDialog'
import { BoardPopulateBanner } from './board/BoardPopulateBanner'
import { DescriptionField } from './board/DescriptionField'

function tempId() {
  return `optim-${crypto.randomUUID()}`
}

function BoardDescriptionPeek(props: { text: string; grabGen: Accessor<number> }) {
  const desc = createDescriptionPeek({ resetOn: props.grabGen })
  const [needsFade, attachClip] = createDescPeekNeedsFade({
    peek: desc.peek,
    refresh: () => `${props.text}\0${props.grabGen()}`,
  })
  return (
    <span
      ref={(el) => attachClip(el ?? undefined)}
      class={`relative mt-0.5 block leading-tight [overflow-wrap:anywhere] ${BOARD_DESCRIPTION_TEXT_CLASS} ${
        desc.peek()
          ? 'scrollbar-none max-h-[min(65vh,22rem)] overflow-y-auto'
          : 'max-h-[5.25rem] min-h-[2.75rem] overflow-hidden'
      }`}
      style={{ transition: desc.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
      onPointerEnter={() => desc.schedule()}
      onPointerLeave={() => desc.clear()}
    >
      <span class="relative z-0 whitespace-pre-wrap break-words text-fg-muted">{props.text}</span>
      <Show when={needsFade()}>
        <span
          class={`peek-desc-fade peek-desc-fade--elevated absolute inset-x-0 bottom-0 z-[1] block ${
            desc.peek() ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transition: desc.peek() ? DESCRIPTION_DESC_CLOSE : DESCRIPTION_DESC_OPEN }}
          aria-hidden="true"
        />
      </Show>
    </span>
  )
}

type BoardRow = BoardResponse & { optimistic?: boolean }

export default function BoardsPage() {
  const navigate = useNavigate()
  const [boards, setBoards] = createSignal<BoardRow[] | undefined>(undefined)
  const [loadError, setLoadError] = createSignal<string | null>(null)

  const [boardsResource] = createResource(async () => {
    const { data } = await listBoards()
    return data
  })
  const [boardDescGrabGen, setBoardDescGrabGen] = createSignal(0)

  createEffect(() => {
    const d = boardsResource()
    if (d !== undefined) setBoards(d)
  })

  createEffect(() => {
    const e = boardsResource.error
    if (!e) return
    if (e instanceof ApiError && e.status === 401) {
      navigate('/login', { replace: true })
      return
    }
    if (e instanceof ApiError) setLoadError(e.message)
    else setLoadError(copy.somethingWrong)
  })

  const skeletonRows = [0, 1, 2, 3, 4]
  const boardsSkeletonActive = () => boardsResource.loading && boards() === undefined
  const boardsSkeletonVisible = createDelayedSkeletonShow(boardsSkeletonActive)

  const [editOpen, setEditOpen] = createSignal(false)
  const [editTarget, setEditTarget] = createSignal<BoardRow | null>(null)
  const [editName, setEditName] = createSignal('')
  const [editDesc, setEditDesc] = createSignal('')
  const [deleteOpen, setDeleteOpen] = createSignal(false)
  const [deleteTarget, setDeleteTarget] = createSignal<BoardRow | null>(null)

  const [createOpen, setCreateOpen] = createSignal(false)
  const [createName, setCreateName] = createSignal('')
  const [createDesc, setCreateDesc] = createSignal('')
  const [createFieldError, setCreateFieldError] = createSignal<string | null>(null)
  const [populateBusy, setPopulateBusy] = createSignal(false)
  const [exportOpen, setExportOpen] = createSignal(false)
  const [exportBoardId, setExportBoardId] = createSignal('')
  const [exportBusy, setExportBusy] = createSignal(false)
  const [importProgress, setImportProgress] = createSignal<PopulateStressProgress | null>(null)
  const [importBusy, setImportBusy] = createSignal(false)
  let editNameInput: HTMLInputElement | undefined
  let editDescInput: HTMLTextAreaElement | undefined
  let createNameInput: HTMLInputElement | undefined
  let createDescInput: HTMLTextAreaElement | undefined
  let deleteBoardContentEl: HTMLElement | undefined

  createEffect(() => {
    if (!createOpen()) return
    queueMicrotask(() => createNameInput?.focus())
  })

  createEffect(() => {
    if (!editOpen()) return
    queueMicrotask(() => editNameInput?.focus())
  })

  const openEdit = (b: BoardRow) => {
    setEditTarget(b)
    setEditName(b.name)
    setEditDesc(b.description)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    const b = editTarget()
    if (!b) return
    const prev = boards() ?? []
    const name = editName().trim() || copy.newBoardName
    const description = editDesc()
    setBoards((list) =>
      list?.map((x) => (x.id === b.id ? { ...x, name, description } : x)),
    )
    setEditOpen(false)
    try {
      const { data } = await patchBoard(b.id, { name, description })
      setBoards((list) => list?.map((x) => (x.id === b.id ? { ...data, optimistic: x.optimistic } : x)))
    } catch {
      setBoards(prev)
      setLoadError(copy.somethingWrong)
    }
  }

  const confirmDelete = async () => {
    const b = deleteTarget()
    if (!b) return
    const prev = boards() ?? []
    setBoards((list) => list?.filter((x) => x.id !== b.id))
    setDeleteOpen(false)
    try {
      await deleteBoard(b.id)
    } catch {
      setBoards(prev)
      setLoadError(copy.somethingWrong)
    }
  }

  const submitCreateBoard = async () => {
    const name = createName().trim()
    if (!name) {
      setCreateFieldError(copy.nameRequired)
      return
    }
    setCreateFieldError(null)
    const description = createDesc()
    const id = tempId()
    const optimistic: BoardRow = {
      id,
      name,
      description,
      ownerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      optimistic: true,
    }
    const prev = boards() ?? []
    setBoards([...prev, optimistic])
    setCreateOpen(false)
    setCreateName('')
    setCreateDesc('')
    try {
      const { data } = await createBoard({ name, description })
      setBoards((list) => list?.map((x) => (x.id === id ? { ...data, optimistic: false } : x)))
      setCachedBoardCounts(data.id, 0, 0)
    } catch {
      setBoards(prev)
      setLoadError(copy.somethingWrong)
    }
  }

  const runPopulateStressBoard = async () => {
    if (populateBusy()) return
    setPopulateBusy(true)
    setLoadError(null)
    try {
      const { board, spec } = await createStressBoardAndSpec()
      writePopulateStressSpec({
        boardId: board.id,
        colCount: spec.colCount,
        taskCounts: spec.taskCounts,
      })
      setBoards((list) => [...(list ?? []), board])
      setCachedBoardCounts(board.id, 0, 0)
      navigate(`/boards/${board.id}?populate=1`)
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : copy.somethingWrong)
    } finally {
      setPopulateBusy(false)
    }
  }

  const openExportDialog = () => {
    const list = boards() ?? []
    if (list.length === 0) return
    const cur = exportBoardId()
    const stillValid = cur && list.some((b) => b.id === cur)
    setExportBoardId(stillValid ? cur : list[0]!.id)
    setExportOpen(true)
  }

  const runCopyBoardJson = async () => {
    const id = exportBoardId()
    if (!id || exportBusy()) return
    setExportBusy(true)
    setLoadError(null)
    try {
      const { data } = await getBoardAggregate(id)
      const payload = serializeBoardToExport(data)
      await copyBoardExportToClipboard(payload)
      setExportOpen(false)
    } catch (e) {
      if (e instanceof ApiError) setLoadError(e.message)
      else if (e instanceof DOMException && e.name === 'NotAllowedError') {
        setLoadError(copy.clipboardAccessDenied)
      } else setLoadError(copy.somethingWrong)
    } finally {
      setExportBusy(false)
    }
  }

  const runPasteBoardJson = async () => {
    if (importBusy()) return
    setImportBusy(true)
    setLoadError(null)
    let raw: string
    try {
      raw = await navigator.clipboard.readText()
    } catch {
      setLoadError(copy.clipboardAccessDenied)
      setImportBusy(false)
      return
    }
    if (!raw.trim()) {
      setLoadError(copy.importBoardInvalid)
      setImportBusy(false)
      return
    }
    let payload: BoardExportV1
    try {
      payload = parseBoardExportJson(raw)
    } catch {
      setLoadError(copy.importBoardInvalid)
      setImportBusy(false)
      return
    }
    try {
      const { data } = await createBoard({
        name: payload.board.name,
        description: payload.board.description,
      })
      setBoards((list) => [...(list ?? []), data])
      const totalCols = payload.columns.length
      const totalTasks = payload.columns.reduce((n, c) => n + c.tasks.length, 0)
      setCachedBoardCounts(data.id, 0, 0)
      await runImportBoardLive(data.id, payload, {
        onProgress: (p) => setImportProgress(p),
        onColumn: () => {},
        onTask: () => {},
      })
      setCachedBoardCounts(data.id, totalCols, totalTasks)
      setImportProgress(null)
    } catch (e) {
      setImportProgress(null)
      setLoadError(e instanceof ApiError ? e.message : copy.somethingWrong)
    } finally {
      setImportBusy(false)
    }
  }

  const rowHeightClass = 'min-h-[7rem]'

  return (
    <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-fg">{copy.boardListTitle}</h1>
          <p class="mt-1 text-sm text-fg-muted">{copy.canvasPanHint}</p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-3 py-2 text-sm font-medium text-fg hover:bg-bg disabled:pointer-events-none disabled:opacity-55"
            disabled={exportBusy() || (boards() ?? []).length === 0}
            onClick={() => openExportDialog()}
          >
            {copy.copyBoardJson}
          </button>
          <button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-3 py-2 text-sm font-medium text-fg hover:bg-bg disabled:pointer-events-none disabled:opacity-55"
            disabled={importBusy()}
            onClick={() => void runPasteBoardJson()}
          >
            {copy.pasteBoardJson}
          </button>
        </div>
      </div>

      <Show when={loadError()}>
        <p class="text-sm text-danger" role="alert">
          {loadError()}
        </p>
      </Show>

      <BoardPopulateBanner progress={importProgress} title={copy.importBoardBanner} />

      <Show
        when={!boardsResource.loading || boards()}
        fallback={
          <ul
            class="flex flex-col gap-3 transition-opacity ease-out"
            style={{ 'transition-duration': `${SKELETON_FADE_MS}ms` }}
            classList={{
              'opacity-0': !boardsSkeletonVisible(),
              'opacity-100': boardsSkeletonVisible(),
            }}
            aria-busy="true"
            aria-label={copy.loadingBoards}
          >
            <For each={skeletonRows}>
              {() => (
                <li
                  class={`rounded-[var(--radius-card)] border border-border bg-bg-elevated p-4 shadow-card ${rowHeightClass}`}
                >
                  <div class="mb-2 h-4 w-2/5 rounded shimmer" />
                  <div class="h-3 w-full max-w-md rounded shimmer" />
                </li>
              )}
            </For>
          </ul>
        }
      >
        <ul class="flex flex-col gap-3">
          <Show
            when={(boards() ?? []).length > 0}
            fallback={
              <p class="rounded-[var(--radius-card)] border border-dashed border-border bg-bg-muted/40 px-4 py-6 text-center text-sm text-fg-muted">
                {copy.emptyBoards}
              </p>
            }
          >
            <For each={boards() ?? []}>
              {(b) => (
                <li
                  class={`group relative overflow-visible rounded-[var(--radius-card)] border border-border bg-bg-elevated shadow-card transition hover:border-accent/30 ${rowHeightClass}`}
                >
                  <button
                    type="button"
                    class="relative z-0 flex h-full w-full flex-col items-stretch gap-1 overflow-visible rounded-[var(--radius-card)] p-4 text-left"
                    onPointerDown={() => setBoardDescGrabGen((g) => g + 1)}
                    onClick={() => navigate(`/boards/${b.id}`)}
                  >
                    <span class="text-lg font-medium leading-tight text-fg">{b.name}</span>
                    <Show
                      when={(b.description ?? '').trim()}
                      fallback={
                        <span class={`mt-0.5 block min-h-[2.5rem] leading-tight text-fg-muted ${BOARD_DESCRIPTION_TEXT_CLASS}`}>
                          <span class="select-none text-fg/[0.2]">{copy.noDescription}</span>
                        </span>
                      }
                    >
                      <BoardDescriptionPeek text={b.description} grabGen={boardDescGrabGen} />
                    </Show>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border/35 pt-1.5">
                      <Show when={getCachedBoardCounts(b.id)}>
                        {(c) => (
                          <span class="inline-flex max-w-full shrink-0 rounded-md border border-border/55 bg-bg-muted/40 px-2 py-0.5 text-[10px] font-medium leading-none tabular-nums text-fg-muted">
                            {formatBoardCompactStats(c().columns, c().tasks)}
                          </span>
                        )}
                      </Show>
                      <span class="inline-flex max-w-full shrink-0 items-center rounded-md border border-border/55 bg-bg-muted/40 px-2 py-0.5 text-[10px] font-medium leading-snug tabular-nums text-fg-muted/90">
                        <span class="tabular-nums" title={b.createdAt}>
                          {copy.boardCreated} {formatShortDateTime(b.createdAt)}
                        </span>
                        <span class="mx-1 text-fg-muted/40">·</span>
                        <span class="tabular-nums" title={b.updatedAt}>
                          {copy.boardUpdated} {formatShortDateTime(b.updatedAt)}
                        </span>
                      </span>
                    </div>
                  </button>
                  <div class="absolute right-3 top-3 z-20 flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      class="kb-focus-ring flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-border bg-bg-muted text-fg hover:bg-bg"
                      aria-label={copy.editBoard}
                      onPointerDown={() => setBoardDescGrabGen((g) => g + 1)}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(b)
                      }}
                    >
                      <Pencil class="size-3" />
                    </button>
                    <button
                      type="button"
                      class="kb-focus-ring flex size-8 items-center justify-center rounded-[var(--radius-control)] border border-border bg-bg-muted text-danger hover:bg-bg"
                      aria-label={copy.deleteBoard}
                      onPointerDown={() => setBoardDescGrabGen((g) => g + 1)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(b)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 class="size-3" />
                    </button>
                  </div>
                </li>
              )}
            </For>
          </Show>

          <li>
            <button
              type="button"
              class={`kb-focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-bg-muted/30 text-fg-muted transition hover:border-accent/40 hover:bg-bg-muted/50 hover:text-fg ${rowHeightClass}`}
              onClick={() => {
                setCreateName('')
                setCreateDesc('')
                setCreateFieldError(null)
                setCreateOpen(true)
              }}
            >
              <span class="text-lg font-medium text-fg">{copy.createBoard}</span>
              <span class="text-xs">{copy.newBoardDescription}</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              class={`kb-focus-ring flex w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border bg-bg-muted/30 text-fg-muted transition hover:border-accent/40 hover:bg-bg-muted/50 hover:text-fg disabled:pointer-events-none disabled:opacity-55 ${rowHeightClass}`}
              disabled={populateBusy()}
              onClick={() => void runPopulateStressBoard()}
            >
              <span class="text-lg font-medium text-fg">{copy.populateBoard}</span>
              <span class="text-center text-xs">{copy.populateBoardBlurb}</span>
              <Show when={populateBusy()}>
                <span class="text-center text-[11px] text-fg-muted">{copy.routeLoading}</span>
              </Show>
            </button>
          </li>
        </ul>
      </Show>

      <BoardFormDialog
        title={copy.copyBoardTitle}
        srOnlyDescription={copy.copyBoardTitle}
        backdropBlur
        open={exportOpen()}
        onOpenChange={setExportOpen}
      >
        <div class="mt-4 flex flex-col gap-2">
          <span class="text-sm font-medium text-fg">{copy.copyBoardPick}</span>
          <select
            class="kb-focus-ring w-full rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-sm text-fg"
            value={exportBoardId()}
            onChange={(e) => setExportBoardId(e.currentTarget.value)}
          >
            <For each={boards() ?? []}>
              {(b) => <option value={b.id}>{b.name}</option>}
            </For>
          </select>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setExportOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white disabled:pointer-events-none disabled:opacity-55"
            disabled={exportBusy() || !exportBoardId()}
            onClick={() => void runCopyBoardJson()}
          >
            {copy.copyBoardJson}
          </Button>
        </div>
      </BoardFormDialog>

      <BoardFormDialog
        title={copy.createBoardTitle}
        srOnlyDescription={copy.createBoardTitle}
        backdropBlur
        open={createOpen()}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            setCreateName('')
            setCreateDesc('')
            setCreateFieldError(null)
          }
        }}
      >
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1.5">
            <TextField.Label class="text-sm font-medium">{copy.boardName}</TextField.Label>
            <TextField.Input
              ref={(el) => (createNameInput = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              placeholder={copy.newBoardName}
              value={createName()}
              onInput={(e) => setCreateName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => createDescInput)}
            />
          </TextField>
          <DescriptionField
            label={copy.boardDescription}
            value={createDesc}
            onInput={setCreateDesc}
            maxLength={DESCRIPTION_MAX_CHARS}
            placeholder={copy.newBoardDescription}
            ref={(el) => (createDescInput = el)}
            onKeyDown={enterCtrlMetaSubmit(submitCreateBoard)}
          />
          <Show when={createFieldError()}>
            <p class="text-sm text-danger" role="alert">
              {createFieldError()}
            </p>
          </Show>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setCreateOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void submitCreateBoard()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>

      <BoardFormDialog
        title={copy.editBoard}
        srOnlyDescription={copy.editBoard}
        backdropBlur
        open={editOpen()}
        onOpenChange={setEditOpen}
      >
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1.5">
            <TextField.Label class="text-sm font-medium">{copy.boardName}</TextField.Label>
            <TextField.Input
              ref={(el) => (editNameInput = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              value={editName()}
              onInput={(e) => setEditName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => editDescInput)}
            />
          </TextField>
          <DescriptionField
            label={copy.boardDescription}
            value={editDesc}
            onInput={setEditDesc}
            maxLength={DESCRIPTION_MAX_CHARS}
            ref={(el) => (editDescInput = el)}
            onKeyDown={enterCtrlMetaSubmit(saveEdit)}
          />
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setEditOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="kb-focus-ring rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void saveEdit()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>

      <Dialog open={deleteOpen()} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Dialog.Content
              ref={(el) => {
                deleteBoardContentEl = el
              }}
              class="w-full max-w-2xl rounded-[var(--radius-card)] border border-border bg-bg-elevated p-6 shadow-card"
              tabIndex={-1}
              onOpenAutoFocus={(e) => {
                e.preventDefault()
                queueMicrotask(() => deleteBoardContentEl?.focus())
              }}
              onKeyDown={enterConfirmDelete(confirmDelete)}
            >
              <Dialog.Title class="text-lg font-semibold text-fg">{copy.deleteBoard}</Dialog.Title>
              <p class="mt-2 text-sm text-fg-muted">{copy.deleteBoardConfirm}</p>
              <div class="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
                  onClick={() => setDeleteOpen(false)}
                >
                  {copy.cancel}
                </Button>
                <Button
                  type="button"
                  class="kb-focus-ring rounded-[var(--radius-control)] bg-danger px-4 py-2 text-sm font-medium text-white"
                  onClick={() => void confirmDelete()}
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
