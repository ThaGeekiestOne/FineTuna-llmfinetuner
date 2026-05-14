import { createReadStream, existsSync, statSync } from 'node:fs'
import { basename, relative, resolve, sep } from 'node:path'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../../authSession.mjs'
import { getJob } from '../../../jobsStore.mjs'
import { resolveRuntimePath } from '../../../runtimePaths.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' })

    const url = new URL(request.url ?? 'http://localhost/api/kaggle/jobs/artifact', 'http://localhost')
    const jobId = url.searchParams.get('jobId') ?? ''
    const file = url.searchParams.get('file') ?? ''
    if (!jobId || !file) return send(response, 400, { error: 'Missing jobId or file' })

    const accessToken = readCookie(request, supabaseAccessCookieName)
    const job = await getJob(jobId, accessToken)
    if (job && job.userId !== user.id) return send(response, 404, { error: 'Artifact not found' })
    if (!job) return send(response, 404, { error: 'Artifact not found' })

    const outputRoot = resolveRuntimePath('kaggle-runs', job.id, 'output')
    const targetPath = resolve(outputRoot, file)
    const relativePath = relative(outputRoot, targetPath)
    if (!relativePath || relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
      return send(response, 400, { error: 'Invalid artifact path' })
    }

    if (!existsSync(targetPath) || !statSync(targetPath).isFile()) return send(response, 404, { error: 'Artifact not found' })

    const safeName = basename(targetPath).replace(/["\r\n]/g, '_')
    response.statusCode = 200
    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    createReadStream(targetPath).pipe(response)
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Artifact download failed' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}
