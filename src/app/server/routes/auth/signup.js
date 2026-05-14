import { signUpUser } from '../../authProvider.mjs'
import { startAuthenticatedSession } from '../../authSession.mjs'

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return send(response, 405, { error: 'Method not allowed' })
    const body = await readJson(request)
    const authResult = await signUpUser(body)
    if (authResult.provider !== 'supabase' || authResult.accessToken) {
      await startAuthenticatedSession(response, authResult)
    }
    return send(response, authResult.emailConfirmationRequired ? 202 : 201, {
      user: authResult.user,
      provider: authResult.provider,
      confirmationRequired: Boolean(authResult.emailConfirmationRequired),
    })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Signup failed' })
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
