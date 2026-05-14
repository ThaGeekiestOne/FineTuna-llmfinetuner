import { dispatchApiRoute } from '../server/routes/router.mjs'

export default async function handler(request, response) {
  const handled = await dispatchApiRoute(request, response)
  if (handled) return

  response.statusCode = 404
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ error: 'API route not found' }))
}
