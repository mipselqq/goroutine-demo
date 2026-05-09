import { createMemo, type ParentComponent, Show } from 'solid-js'
import { A, useNavigate } from '@solidjs/router'
import { clearToken, getAuthEpoch, getToken } from '../lib/auth'
import { copy } from '../lib/copy'
import { PendingBadge } from './PendingBadge'

export const AppShell: ParentComponent = (props) => {
  const navigate = useNavigate()
  const authed = createMemo(() => {
    getAuthEpoch()
    return !!getToken()
  })

  return (
    <div class="flex min-h-dvh flex-col">
      <header class="flex items-center justify-between gap-4 border-b border-border bg-bg-elevated/80 px-4 py-3 backdrop-blur-md">
        <div class="flex items-center gap-6">
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
      </header>
      <main class="flex flex-1 flex-col">{props.children}</main>
      <PendingBadge />
    </div>
  )
}
