import { createEffect, createSignal, Show } from 'solid-js'
import { Button } from '@kobalte/core/button'
import { TextField } from '@kobalte/core/text-field'
import { Plus } from 'lucide-solid'
import { copy } from '../../lib/copy'
import { enterCtrlMetaSubmit, enterFocusDescription } from '../../lib/formEnter'
import {
  createColumn,
  DESCRIPTION_MAX_CHARS,
  NAME_MAX_CHARS,
  POSITION_BASE,
  type AggregateBoardResponse,
  type AggregateColumnResponse,
} from '../../lib/api'
import { validateEntityName, validateOptionalDescription } from '../../lib/clientValidation'
import { isClientValidationBypassed } from '../../lib/clientValidationBypass'
import { userFacingApiError } from '../../lib/apiUserMessage'
import { BoardFormDialog } from './BoardFormDialog'
import { DescriptionField } from './DescriptionField'
import { FormApiAlert } from './FormApiAlert'
import { FieldLabelWithCount } from './FieldLabelWithCount'

export function AddColumnZone(props: {
  boardId: string
  setBoard: (fn: (b: AggregateBoardResponse) => void) => void
}) {
  const [open, setOpen] = createSignal(false)
  const [name, setName] = createSignal('')
  const [desc, setDesc] = createSignal('')
  const [fieldErr, setFieldErr] = createSignal<string | null>(null)
  let nameEl: HTMLInputElement | undefined
  let descEl: HTMLTextAreaElement | undefined

  createEffect(() => {
    if (!open()) return
    queueMicrotask(() => nameEl?.focus())
  })

  const submit = async () => {
    if (!isClientValidationBypassed()) {
      const vn = validateEntityName(name())
      if (vn) {
        setFieldErr(vn)
        return
      }
      const vd = validateOptionalDescription(desc())
      if (vd) {
        setFieldErr(vd)
        return
      }
    }
    setFieldErr(null)
    const nm = name().trim()
    const ds = desc().trim()
    const id = `optim-${crypto.randomUUID()}`
    const optimistic: AggregateColumnResponse = {
      id,
      boardId: props.boardId,
      name: nm,
      description: ds,
      position: 999,
      tasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    props.setBoard((b) => {
      b.columns = [...b.columns, optimistic]
      b.columns.forEach((c, i) => {
        c.position = i + POSITION_BASE
      })
    })
    setOpen(false)
    setName('')
    setDesc('')
    try {
      const { data } = await createColumn(props.boardId, { name: nm, description: ds })
      props.setBoard((b) => {
        b.columns = b.columns.map((c) => (c.id === id ? { ...data, tasks: [] } : c))
        b.columns.forEach((c, i) => {
          c.position = i + POSITION_BASE
        })
      })
    } catch (e) {
      props.setBoard((b) => {
        b.columns = b.columns.filter((c) => c.id !== id)
      })
      setName(nm)
      setDesc(ds)
      setOpen(true)
      setFieldErr(userFacingApiError(e))
    }
  }

  return (
    <>
      <button
        type="button"
        data-board-interactive=""
        class="flex w-16 shrink-0 flex-col items-center justify-center gap-2 self-stretch rounded-[var(--radius-card)] border border-dashed border-border bg-bg-muted/50 text-fg-muted hover:border-accent/40 hover:bg-bg-muted/70 hover:text-fg"
        onClick={() => {
          setName('')
          setDesc('')
          setFieldErr(null)
          setOpen(true)
        }}
        aria-label={copy.addColumn}
      >
        <Plus class="size-7" />
      </button>

      <BoardFormDialog
        title={copy.createColumnTitle}
        open={open()}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setName('')
            setDesc('')
            setFieldErr(null)
          }
        }}
      >
        <div class="mt-4 flex flex-col gap-3">
          <TextField class="flex flex-col gap-1">
            <TextField.Label class="block w-full">
              <FieldLabelWithCount label={copy.columnName} length={name().length} max={NAME_MAX_CHARS} />
            </TextField.Label>
            <TextField.Input
              ref={(el) => (nameEl = el)}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2 text-fg"
              placeholder={copy.newColumnName}
              value={name()}
              maxLength={isClientValidationBypassed() ? undefined : NAME_MAX_CHARS}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={enterFocusDescription(() => descEl)}
            />
          </TextField>
          <DescriptionField
            label={copy.columnDescription}
            value={desc}
            onInput={setDesc}
            maxLength={isClientValidationBypassed() ? undefined : DESCRIPTION_MAX_CHARS}
            charCountMax={DESCRIPTION_MAX_CHARS}
            placeholder={copy.newColumnDescription}
            ref={(el) => (descEl = el)}
            onKeyDown={enterCtrlMetaSubmit(submit)}
          />
          <Show when={fieldErr()}>
            <FormApiAlert message={fieldErr()!} />
          </Show>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            class="rounded-[var(--radius-control)] border border-border bg-bg-muted px-4 py-2 text-sm"
            onClick={() => setOpen(false)}
          >
            {copy.cancel}
          </Button>
          <Button
            type="button"
            class="rounded-[var(--radius-control)] bg-accent px-4 py-2 text-sm font-medium text-white"
            onClick={() => void submit()}
          >
            {copy.save}
          </Button>
        </div>
      </BoardFormDialog>
    </>
  )
}
