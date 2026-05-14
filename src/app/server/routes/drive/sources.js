import { listDocumentSources, saveDocumentSources } from '../../documentSourcesStore.mjs'
import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../authSession.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    const accessToken = readCookie(request, supabaseAccessCookieName)

    if (request.method === 'GET') {
      return send(response, 200, { sources: await listDocumentSources(user.id, accessToken) })
    }

    if (request.method === 'POST') {
      const body = await readJson(request)
      const sources = await saveDocumentSources(body.sources ?? [], user.id, accessToken)
      return send(response, 200, { sources })
    }

    return send(response, 405, { error: 'Method not allowed' })
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Could not persist document sources' })
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
