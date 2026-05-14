import { destroyAuthenticatedSession, readAuthenticatedUser } from '../../authSession.mjs'

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const session = await readAuthenticatedUser(request, response)
      return send(response, 200, { authenticated: Boolean(session?.user), user: session?.user ?? null, provider: session?.provider ?? null })
    }

    if (request.method === 'DELETE') {
      await destroyAuthenticatedSession(request, response)
      return send(response, 200, { authenticated: false, user: null })
    }

    return send(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Session request failed' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}
