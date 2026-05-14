import { getKaggleCredentials, hasKaggleCredentials, saveKaggleCredentials } from '../../kaggleCredentialsStore.mjs'
import { getKaggleOAuthStatus } from '../../kaggleAuthRuntime.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../authSession.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readCookie(request, supabaseAccessCookieName)
    if (request.method === 'GET') {
      const [credentials, configured, oauth] = await Promise.all([
        getKaggleCredentials(user.id, accessToken),
        hasKaggleCredentials(user.id, accessToken),
        getKaggleOAuthStatus(),
      ])
      if (oauth.configured) {
        return send(response, 200, {
          configured: true,
          username: oauth.username ?? credentials?.username ?? null,
          authMethod: 'oauth',
        })
      }
      return send(response, 200, {
        configured,
        username: credentials?.username ?? null,
        authMethod: configured ? 'api-key' : null,
      })
    }

    if (request.method === 'POST') {
      const body = await readJson(request)
      await saveKaggleCredentials(body, user.id, accessToken)
      return send(response, 200, { configured: true, username: body.username, authMethod: 'api-key' })
    }

    return send(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Credentials request failed' })
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
