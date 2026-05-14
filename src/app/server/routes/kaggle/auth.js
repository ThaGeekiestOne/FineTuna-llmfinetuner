import { getKaggleOAuthStatus } from '../../kaggleAuthRuntime.mjs'
import { requireAuthenticatedUser } from '../../authSession.mjs'
import { confirmKaggleOAuthCode, getKaggleOAuthSessionStatus, revokeKaggleOAuthLogin, startKaggleOAuthLogin } from '../../kaggleAuthService.mjs'

export default async function handler(request, response) {
  try {
    await requireAuthenticatedUser(request, response)
    if (request.method === 'GET') {
      const [oauth, session] = await Promise.all([getKaggleOAuthStatus(), getKaggleOAuthSessionStatus()])
      return send(response, 200, { oauth, ...session })
    }

    if (request.method === 'POST') {
      const body = await readJson(request)
      if (body.action === 'start') {
        const session = await startKaggleOAuthLogin(Boolean(body.force))
        const oauth = await getKaggleOAuthStatus()
        return send(response, 200, { oauth, ...session })
      }
      if (body.action === 'confirm') {
        const session = await confirmKaggleOAuthCode(body.code ?? '')
        const oauth = await getKaggleOAuthStatus()
        return send(response, 200, { oauth, ...session })
      }
      return send(response, 400, { error: 'Unsupported auth action' })
    }

    if (request.method === 'DELETE') {
      const revoked = await revokeKaggleOAuthLogin()
      const oauth = await getKaggleOAuthStatus()
      return send(response, 200, { oauth, revoked: revoked.revoked })
    }

    return send(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Kaggle auth request failed' })
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
