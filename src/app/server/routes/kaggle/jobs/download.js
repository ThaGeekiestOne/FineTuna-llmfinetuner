import { applyCompletedKaggleOutput, downloadKaggleExecutionOutput } from '../../../kaggleService.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../../authSession.mjs'
import { getJob, updateJob } from '../../../jobsStore.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' })
    const body = await readJson(request)
    const jobId = typeof body.jobId === 'string' ? body.jobId : ''
    if (body.confirmOutputDownload !== true) {
      return send(response, 400, { error: 'Explicit output download confirmation is required' })
    }
    const accessToken = readCookie(request, supabaseAccessCookieName)
    const job = await getJob(jobId, accessToken)
    if (job && job.userId !== user.id) return send(response, 404, { error: 'Kaggle job not found' })
    if (!job || !job.kaggleKernelRef) return send(response, 404, { error: 'Kaggle job not found' })
    if (job.status !== 'completed') return send(response, 409, { error: 'Kaggle output is available after the run completes' })

    const output = await downloadKaggleExecutionOutput(job.id, job.kaggleKernelRef, { userId: user.id, accessToken })
    const patch = applyCompletedKaggleOutput(job, { status: 'completed', progress: 100, eta: 'Complete' }, output)
    const updated = await updateJob(job.id, patch, accessToken)
    return send(response, 200, { job: updated })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Kaggle download failed' })
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
