import authLoginHandler from './auth/login.js'
import authOAuthHandler from './auth/oauth.js'
import authSessionHandler from './auth/session.js'
import authSignupHandler from './auth/signup.js'
import driveAuthHandler from './drive/auth.js'
import driveCallbackHandler from './drive/callback.js'
import driveFilesHandler from './drive/files.js'
import driveSourcesHandler from './drive/sources.js'
import jobsHandler from './jobs.js'
import jobByIdHandler from './jobs/[id].js'
import kaggleAuthHandler from './kaggle/auth.js'
import kaggleCredentialsHandler from './kaggle/credentials.js'
import kaggleJobArtifactHandler from './kaggle/jobs/artifact.js'
import kaggleJobDownloadHandler from './kaggle/jobs/download.js'
import kaggleJobStartHandler from './kaggle/jobs/start.js'
import kaggleJobStatusHandler from './kaggle/jobs/status.js'
import modelsHandler from './models.js'

export async function dispatchApiRoute(request, response) {
  const path = getPathname(request)

  if (path === '/api/models') return run(modelsHandler, request, response)
  if (path === '/api/auth/login') return run(authLoginHandler, request, response)
  if (path === '/api/auth/oauth') return run(authOAuthHandler, request, response)
  if (path === '/api/auth/signup') return run(authSignupHandler, request, response)
  if (path === '/api/auth/session') return run(authSessionHandler, request, response)
  if (path === '/api/kaggle/credentials') return run(kaggleCredentialsHandler, request, response)
  if (path === '/api/kaggle/auth') return run(kaggleAuthHandler, request, response)
  if (path === '/api/kaggle/jobs/start') return run(kaggleJobStartHandler, request, response)
  if (path === '/api/kaggle/jobs/download') return run(kaggleJobDownloadHandler, request, response)
  if (path === '/api/kaggle/jobs/artifact') return run(kaggleJobArtifactHandler, request, response)
  if (path === '/api/kaggle/jobs/status') return run(kaggleJobStatusHandler, request, response)
  if (path.startsWith('/api/jobs/')) return run(jobByIdHandler, request, response)
  if (path === '/api/jobs') return run(jobsHandler, request, response)
  if (path === '/api/drive/callback') return run(driveCallbackHandler, request, response)
  if (path === '/api/drive/files') return run(driveFilesHandler, request, response)
  if (path === '/api/drive/sources') return run(driveSourcesHandler, request, response)
  if (path === '/api/drive/auth') return run(driveAuthHandler, request, response)

  return false
}

function getPathname(request) {
  return new URL(request.url ?? 'http://localhost/api', 'http://localhost').pathname
}

async function run(handler, request, response) {
  await handler(request, response)
  return true
}
