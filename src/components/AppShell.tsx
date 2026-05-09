import { createMemo, type ParentComponent, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { A, useNavigate } from '@solidjs/router'
import { clearToken, getAuthEpoch, getToken } from '../lib/auth'
import { copy } from '../lib/copy'
import { setShellBypassExcludeEl } from '../lib/shellBypassExclude'
import { isClientValidationBypassed, toggleClientValidationBypass } from '../lib/clientValidationBypass'
import { PendingBadge } from './PendingBadge'

export const AppShell: ParentComponent = (props) => {
  const navigate = useNavigate()
  const authed = createMemo(() => {
    getAuthEpoch()
    return !!getToken()
  })

  return (
    <div class="flex min-h-dvh flex-col">
      <header class="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-bg-elevated/80 px-4 backdrop-blur-md">
        <div class="flex min-w-0 flex-1 items-center gap-6 pr-4">
          <A
            href="/boards"
            class="text-base font-semibold tracking-tight text-fg no-underline hover:text-accent"
            end
          >
            {copy.appTitle}
          </A>
          <Show when={authed()}>
            <nav class="flex gap-4 text-sm text-fg-muted">
              <A
                href="/boards"
                class="rounded-[var(--radius-control)] px-2 py-1 no-underline hover:bg-bg-muted hover:text-fg"
                activeClass="bg-bg-muted text-fg"
              >
                {copy.boards}
              </A>
            </nav>
          </Show>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <Show when={authed()}>
            <button
              type="button"
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg-muted px-3 py-2 text-sm text-fg transition active:scale-[0.98] hover:border-accent/40 hover:bg-bg-elevated"
              onClick={() => {
                clearToken()
                navigate('/login', { replace: true })
              }}
            >
              {copy.logout}
            </button>
          </Show>
        </div>
      </header>
      {/* Bypass only: above modal layers; excluded from Dialog dismiss — keep strip height = header (h-14) */}
      <Portal mount={document.body}>
        <div
          ref={(el) => setShellBypassExcludeEl(el ?? undefined)}
          class={`pointer-events-none fixed inset-x-0 top-0 z-[100000] flex h-14 items-center justify-end pl-4 ${
            authed() ? 'pr-25' : 'pr-4'
          }`}
        >
          <button
            type="button"
            aria-pressed={isClientValidationBypassed()}
            title={copy.clientValidationBypass}
            class={`pointer-events-auto kb-focus-ring rounded-[var(--radius-control)] border px-3 py-2 text-sm transition active:scale-[0.98] ${
              isClientValidationBypassed()
                ? 'border-sky-400/45 bg-sky-500/15 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.22)] hover:border-sky-400/60 hover:bg-sky-500/25'
                : 'border-border bg-bg-muted text-fg-muted hover:border-accent/40 hover:bg-bg-elevated hover:text-fg'
            }`}
            onClick={() => toggleClientValidationBypass()}
          >
            {copy.clientValidationBypass}
          </button>
        </div>
      </Portal>
      <main class="flex flex-1 flex-col">{props.children}</main>
      <PendingBadge />
    </div>
  )
}
