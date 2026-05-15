import { createSupabaseOAuthSession } from '../../authProvider.mjs'
import { startAuthenticatedSession } from '../../authSession.mjs'

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' })
    const body = await readJson(request)
    const accessToken = typeof body.accessToken === 'string' ? body.accessToken : ''
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''
    if (!accessToken) return send(response, 400, { error: 'Missing Supabase OAuth access token' })

    const authResult = await createSupabaseOAuthSession({ accessToken, refreshToken })
    await startAuthenticatedSession(response, authResult)
    return send(response, 200, { user: authResult.user, provider: authResult.provider })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'OAuth login failed' })
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
