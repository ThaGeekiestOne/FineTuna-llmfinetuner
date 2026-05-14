import { createServer as createHttpServer } from 'node:http'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer as createViteServer } from 'vite'
import kaggleAuthHandler from '../api/kaggle/auth.js'
import kaggleCredentialsHandler from '../api/kaggle/credentials.js'
import kaggleJobStartHandler from '../api/kaggle/jobs/start.js'
import kaggleJobStatusHandler from '../api/kaggle/jobs/status.js'
import kaggleJobDownloadHandler from '../api/kaggle/jobs/download.js'
import kaggleJobArtifactHandler from '../api/kaggle/jobs/artifact.js'
import authLoginHandler from '../api/auth/login.js'
import authSessionHandler from '../api/auth/session.js'
import authSignupHandler from '../api/auth/signup.js'
import modelsHandler from '../api/models.js'
import jobsHandler from '../api/jobs.js'
import jobByIdHandler from '../api/jobs/[id].js'
import driveAuthHandler from '../api/drive/auth.js'
import driveCallbackHandler from '../api/drive/callback.js'
import driveFilesHandler from '../api/drive/files.js'
import driveSourcesHandler from '../api/drive/sources.js'

loadEnvFile('.env')
loadEnvFile('.env.local')

const port = readPort()
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

const server = createHttpServer(async (request, response) => {
  if (request.url?.startsWith('/api/models')) {
    await modelsHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/auth/login')) {
    await authLoginHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/auth/signup')) {
    await authSignupHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/auth/session')) {
    await authSessionHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/credentials')) {
    await kaggleCredentialsHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/auth')) {
    await kaggleAuthHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/jobs/start')) {
    await kaggleJobStartHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/jobs/download')) {
    await kaggleJobDownloadHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/jobs/artifact')) {
    await kaggleJobArtifactHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/kaggle/jobs/status')) {
    await kaggleJobStatusHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/jobs/')) {
    await jobByIdHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/jobs')) {
    await jobsHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/drive/callback')) {
    await driveCallbackHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/drive/files')) {
    await driveFilesHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/drive/sources')) {
    await driveSourcesHandler(request, response)
    return
  }

  if (request.url?.startsWith('/api/drive/auth')) {
    await driveAuthHandler(request, response)
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
