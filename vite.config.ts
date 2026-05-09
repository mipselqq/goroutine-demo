import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'
import solid from 'vite-plugin-solid'

/**
 * GitHub Pages has no server fallback for client routes. Unknown paths get `404.html`.
 * Copying the built SPA shell there lets back/forward and deep links load the app instead of the generic 404 page.
 */
function githubPagesSpa404(): Plugin {
  let outDir = ''
  return {
    name: 'github-pages-spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

/** GitHub Pages project site: `/<repository>/`. Set `VITE_BASE_PATH` in CI (repository name). */
function viteBase(): string {
  const raw = process.env.VITE_BASE_PATH?.trim()
  if (!raw || raw === '/') return '/'
  const inner = raw.replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}

export default defineConfig({
  base: viteBase(),
  plugins: [solid(), tailwindcss(), githubPagesSpa404()],
})
