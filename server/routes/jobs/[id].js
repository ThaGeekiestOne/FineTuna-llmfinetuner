import { deleteJob, getJob, updateJob } from '../../jobsStore.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../authSession.mjs'
import { sendJson } from '../jobs.js'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readCookie(request, supabaseAccessCookieName)
    const id = readJobId(request)
    if (!id) return sendJson(response, 400, { error: 'Job id is required' })
    const existing = await getJob(id, accessToken)
    if (!existing || existing.userId !== user.id) return sendJson(response, 404, { error: 'Job not found' })

    if (request.method === 'GET') {
      return sendJson(response, 200, { job: existing })
    }

    if (request.method === 'PATCH') {
      const body = await readJson(request)
      const job = await updateJob(id, body, accessToken)
      return job ? sendJson(response, 200, { job }) : sendJson(response, 404, { error: 'Job not found' })
    }

    if (request.method === 'DELETE') {
      const deleted = await deleteJob(id, accessToken)
      return deleted ? sendJson(response, 204, {}) : sendJson(response, 404, { error: 'Job not found' })
    }

    return sendJson(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return sendJson(response, 500, { error: error instanceof Error ? error.message : 'Job request failed' })
  }
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}

function readJobId(request) {
  const url = new URL(request.url ?? 'http://localhost/api/jobs', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)
  return parts[2] ?? ''
}
