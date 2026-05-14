import { createServer as createHttpServer } from 'node:http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'
import { dispatchApiRoute } from '../server/routes/router.mjs'

loadEnvFile('.env')
loadEnvFile('.env.local')

const port = readPort()
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

const server = createHttpServer(async (request, response) => {
  if (request.url?.startsWith('/api/')) {
    const handled = await dispatchApiRoute(request, response)
    if (!handled) {
      response.statusCode = 404
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ error: 'API route not found' }))
    }
    return
  }

  vite.middlewares(request, response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`FineTuna dev server: http://127.0.0.1:${port}/`)
})

function loadEnvFile(path) {
  const absolutePath = resolve(path)
  if (existsSync(absolutePath)) process.loadEnvFile(absolutePath)
}

function readPort() {
  const index = process.argv.indexOf('--port')
  if (index >= 0) return Number(process.argv[index + 1])
  return Number(process.env.PORT ?? 5173)
}
