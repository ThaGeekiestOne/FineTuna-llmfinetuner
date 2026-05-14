import { createJob, listJobs } from '../server/jobsStore.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../server/authSession.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readCookie(request, supabaseAccessCookieName)
    if (request.method === 'GET') {
      const jobs = await listJobs(user.id, accessToken)
      return sendJson(response, 200, { jobs })
    }

    if (request.method === 'POST') {
      const body = await readJson(request)
      const job = await createJob({ ...body, userId: user.id }, accessToken)
      return sendJson(response, 201, { job })
    }

    return sendJson(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Jobs request failed' })
  }
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString('utf8')
  return body ? JSON.parse(body) : {}
}
