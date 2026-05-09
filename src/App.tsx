import { onMount, type ParentComponent, Show, Suspense, createMemo, lazy } from 'solid-js'
import { Route, Router, useNavigate } from '@solidjs/router'
import { AppShell } from './components/AppShell'
import { copy } from './lib/copy'
import { getAuthEpoch, getToken } from './lib/auth'

const AuthPage = lazy(() => import('./routes/AuthPage'))
const BoardsPage = lazy(() => import('./routes/BoardsPage'))
const BoardPage = lazy(() => import('./routes/BoardPage'))

function NavigateReplace(props: { href: string }) {
  const navigate = useNavigate()
  onMount(() => {
    navigate(props.href, { replace: true })
  })
  return null
}

const RouteSuspense: ParentComponent = (props) => (
  <Suspense
    fallback={
      <div class="flex flex-1 items-center justify-center text-sm text-fg-muted">
        {copy.routeLoading}
      </div>
    }
  >
    {props.children}
  </Suspense>
)

const PrivateRoute: ParentComponent = (props) => {
  const ok = createMemo(() => {
    getAuthEpoch()
    return !!getToken()
  })
  return (
    <Show when={ok()} fallback={<NavigateReplace href="/login" />}>
      {props.children}
    </Show>
  )
}

const PublicOnly: ParentComponent = (props) => {
  const ok = createMemo(() => {
    getAuthEpoch()
    return !!getToken()
  })
  return (
    <Show when={!ok()} fallback={<NavigateReplace href="/boards" />}>
      {props.children}
    </Show>
  )
}

function LoginRoute() {
  return (
    <PublicOnly>
      <RouteSuspense>
        <AuthPage />
      </RouteSuspense>
    </PublicOnly>
  )
}

function BoardsListRoute() {
  return (
    <PrivateRoute>
      <RouteSuspense>
        <BoardsPage />
      </RouteSuspense>
    </PrivateRoute>
  )
}

function BoardDetailRoute() {
  return (
    <PrivateRoute>
      <RouteSuspense>
        <BoardPage />
      </RouteSuspense>
    </PrivateRoute>
  )
}

export default function App() {
  const base =
    import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')

  return (
    <Router root={AppShell} base={base}>
      <Route path="/" component={() => <NavigateReplace href="/boards" />} />
      <Route path="/login" component={LoginRoute} />
      <Route path="/register" component={() => <NavigateReplace href="/login" />} />
      <Route path="/boards" component={BoardsListRoute} />
      <Route path="/boards/:boardId" component={BoardDetailRoute} />
    </Router>
  )
}
