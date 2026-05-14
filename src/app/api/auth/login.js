import { signInUser } from '../../server/authProvider.mjs'
import { startAuthenticatedSession } from '../../server/authSession.mjs'

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' })
    const body = await readJson(request)
    const authResult = await signInUser(body)
    await startAuthenticatedSession(response, authResult)
    return send(response, 200, { user: authResult.user, provider: authResult.provider })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Login failed' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}
