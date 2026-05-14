import { getJob, updateJob } from '../../../jobsStore.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../../authSession.mjs'
import { startKaggleExecution } from '../../../kaggleService.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' })
    const body = await readJson(request)
    if (!body?.jobId || typeof body.jobId !== 'string') return send(response, 400, { error: 'jobId is required' })
    if (body.examples && !Array.isArray(body.examples)) return send(response, 400, { error: 'examples must be an array' })
    const accessToken = readCookie(request, supabaseAccessCookieName)
    const job = await getJob(body.jobId, accessToken)
    if (job && job.userId !== user.id) return send(response, 404, { error: 'Job not found' })
    if (!job) return send(response, 404, { error: 'Job not found' })
    if (job.kaggleKernelRef) return send(response, 409, { error: 'Job has already been submitted to Kaggle' })
    const remote = await startKaggleExecution(job, body.examples ?? [], { userId: user.id, accessToken })
    const updated = await updateJob(job.id, remote, accessToken)
    return send(response, 200, { job: updated })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Kaggle start failed' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
