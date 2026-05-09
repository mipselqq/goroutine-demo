/** Server/API error inside form dialogs — matches body text size (`text-sm`). */
export function FormApiAlert(props: { message: string }) {
  return (
    <p
      class="whitespace-pre-line rounded-[var(--radius-control)] border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm font-normal leading-normal text-danger"
      role="alert"
    >
      {props.message}
    </p>
  )
}
