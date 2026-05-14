import { getKaggleExecutionStatus } from '../../../server/kaggleService.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../../server/authSession.mjs'
import { getJob, updateJob } from '../../../server/jobsStore.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' })
    const url = new URL(request.url ?? 'http://localhost/api/kaggle/jobs/status', 'http://localhost')
    const jobId = url.searchParams.get('jobId') ?? ''
    const accessToken = readCookie(request, supabaseAccessCookieName)
    const job = await getJob(jobId, accessToken)
    if (job && job.userId !== user.id) return send(response, 404, { error: 'Kaggle job not found' })
    if (!job || !job.kaggleKernelRef) return send(response, 404, { error: 'Kaggle job not found' })

    const remote = await getKaggleExecutionStatus(job.kaggleKernelRef, job, { userId: user.id, accessToken })
    const updated = await updateJob(job.id, remote, accessToken)
    return send(response, 200, { job: updated })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Kaggle status failed' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}
