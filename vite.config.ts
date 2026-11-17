import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Project site: https://omer-dayan.github.io/wedding-planner/
// Hash routes (#/guests) avoid GitHub Pages rewrite rules.
const buildId = readBuildId()

export default defineConfig({
  base: '/wedding-planner/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), emitBuildVersion(buildId)],
})

function readBuildId(): string {
  try {
    const sha = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (/^[0-9a-f]{7,}$/i.test(sha)) return sha.slice(0, 7)
  } catch {
    // A timestamp still changes between builds when git is unavailable.
  }
  return String(Date.now())
}

function emitBuildVersion(id: string): Plugin {
  const body = `${JSON.stringify({ id })}\n`
  return {
    name: 'emit-build-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path !== '/version.json' && !path.endsWith('/version.json')) {
          next()
          return
        }
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(body)
      })
    },
  }
}
