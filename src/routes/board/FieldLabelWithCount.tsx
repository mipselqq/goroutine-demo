export function FieldLabelWithCount(props: { label: string; length: number; max: number }) {
  const over = () => props.length > props.max
  return (
    <div class="flex w-full min-w-0 items-center justify-between gap-2">
      <span class="min-w-0 text-sm font-medium">{props.label}</span>
      <span
        class="shrink-0 tabular-nums text-xs"
        classList={{
          'text-danger': over(),
          'text-fg-muted': !over(),
        }}
      >
        {props.length}/{props.max}
      </span>
    </div>
  )
}
