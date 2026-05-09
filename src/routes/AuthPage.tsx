import { createSignal, Show } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Button } from '@kobalte/core/button'
import { TextField } from '@kobalte/core/text-field'
import { copy } from '../lib/copy'
import { login, register } from '../lib/api'
import { setToken } from '../lib/auth'
import { validateEmail, validatePassword } from '../lib/clientValidation'
import { isClientValidationBypassed } from '../lib/clientValidationBypass'
import { userFacingApiError } from '../lib/apiUserMessage'

const PW_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*-_'

function randomTestEmail(): string {
  const id = crypto.randomUUID().replace(/-/g, '')
  return `goroutine.test.${id}@example.com`
}

function randomTestPassword(length = 14): string {
  const n = Math.max(8, length)
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  let s = ''
  for (let i = 0; i < n; i++) s += PW_CHARS[buf[i]! % PW_CHARS.length]!
  return s
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = createSignal<'login' | 'register'>('login')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [info, setInfo] = createSignal<string | null>(null)

  const onSubmit = async (e: Event) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!isClientValidationBypassed()) {
      const emailErr = validateEmail(email())
      if (emailErr) {
        setError(emailErr)
        return
      }
      const pwErr = validatePassword(password())
      if (pwErr) {
        setError(pwErr)
        return
      }
    }
    setBusy(true)
    try {
      if (mode() === 'login') {
        const { data } = await login({ email: email(), password: password() })
        setToken(data.token)
        navigate('/boards', { replace: true })
      } else {
        await register({ email: email(), password: password() })
        setInfo(copy.registerSuccess)
        setMode('login')
      }
    } catch (err) {
      setError(userFacingApiError(err))
    } finally {
      setBusy(false)
    }
  }

  const loginAsTestUser = async () => {
    if (mode() !== 'login') return
    setError(null)
    setInfo(null)
    setBusy(true)
    const em = randomTestEmail()
    const pw = randomTestPassword()
    try {
      await register({ email: em, password: pw })
      const { data } = await login({ email: em, password: pw })
      setEmail(em)
      setPassword(pw)
      setToken(data.token)
      navigate('/boards', { replace: true })
    } catch (err) {
      setError(userFacingApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="flex flex-1 items-center justify-center px-4 py-12">
      <div class="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-bg-elevated p-8 shadow-card">
        <h1 class="mb-1 text-2xl font-semibold tracking-tight text-fg">
          {mode() === 'login' ? copy.login : copy.register}
        </h1>
        <p class="mb-6 text-sm text-fg-muted">
          {mode() === 'login' ? copy.notSignedUp : copy.alreadyHaveAccount}{' '}
          <button
            type="button"
            class="kb-focus-ring m-0 cursor-pointer border-0 bg-transparent p-0 text-sm text-accent underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode() === 'login' ? 'register' : 'login')
              setError(null)
              setInfo(null)
            }}
          >
            {mode() === 'login' ? copy.register : copy.login}
          </button>
        </p>

        <form
          class="flex flex-col gap-4"
          noValidate={isClientValidationBypassed()}
          onSubmit={onSubmit}
        >
          <TextField class="flex flex-col gap-1.5">
            <TextField.Label class="text-sm font-medium text-fg">{copy.email}</TextField.Label>
            <TextField.Input
              type="email"
              autocomplete="email"
              required={!isClientValidationBypassed()}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2.5 text-fg placeholder:text-fg-muted"
              placeholder="you@example.com"
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
            />
          </TextField>
          <TextField class="flex flex-col gap-1.5">
            <TextField.Label class="text-sm font-medium text-fg">{copy.password}</TextField.Label>
            <TextField.Input
              type="password"
              autocomplete={mode() === 'login' ? 'current-password' : 'new-password'}
              required={!isClientValidationBypassed()}
              minLength={isClientValidationBypassed() ? undefined : 6}
              class="kb-focus-ring rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2.5 text-fg placeholder:text-fg-muted"
              placeholder="••••••••"
              value={password()}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </TextField>

          <Show when={error()}>
            <p class="whitespace-pre-line text-sm text-danger" role="alert">
              {error()}
            </p>
          </Show>
          <Show when={info()}>
            <p class="text-sm text-fg-muted" role="status">
              {info()}
            </p>
          </Show>

          <Button
            type="submit"
            class="kb-focus-ring mt-2 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-accent px-4 py-2.5 text-sm font-medium text-white transition active:scale-[0.99] hover:bg-accent-muted disabled:opacity-50"
            disabled={busy()}
          >
            {mode() === 'login' ? copy.login : copy.register}
          </Button>

          <Show when={mode() === 'login'}>
            <button
              type="button"
              class="kb-focus-ring mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-border/80 bg-transparent px-3 py-2 text-sm text-fg-muted transition hover:border-border hover:bg-bg-muted/40 hover:text-fg active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy()}
              onClick={() => void loginAsTestUser()}
            >
              {copy.loginAsTestUser}
            </button>
          </Show>
        </form>
      </div>
    </div>
  )
}
