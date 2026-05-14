import { readCookie, requireAuthenticatedUser, supabaseAccessCookieName } from '../../server/authSession.mjs'
import { listGoogleDriveFiles } from '../../server/googleDriveService.mjs'

export default async function handler(request, response) {
  try {
    const user = await requireAuthenticatedUser(request, response)
    if (request.method !== 'GET') return send(response, 405, { error: 'Method not allowed' })
    const accessToken = readCookie(request, supabaseAccessCookieName)
    const url = new URL(request.url ?? 'http://localhost/api/drive/files', 'http://localhost')
    const search = url.searchParams.get('search') ?? ''
    const payload = await listGoogleDriveFiles(user.id, accessToken, search)
    return send(response, 200, payload)
  } catch (error) {
    return send(response, error.statusCode ?? 500, { error: error instanceof Error ? error.message : 'Could not load Google Drive files' })
  }
}

function send(response, statusCode, payload) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}
