import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

/** GitHub Pages project site: `/<repository>/`. Set `VITE_BASE_PATH` in CI (repository name). */
function viteBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (!raw || raw === '/') return '/'
  const inner = raw.replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}

export default defineConfig({
  base: viteBase(),
  plugins: [solid(), tailwindcss()],
})
