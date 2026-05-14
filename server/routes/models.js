import { fetchProviderCatalog } from '../providerCatalog.mjs'

export default async function handler(request, response) {
  try {
    const url = new URL(request.url ?? '/api/models', 'http://localhost')
    const search = url.searchParams.get('search') ?? ''
    const offset = Number(url.searchParams.get('offset') ?? '0')
    const userToken = readHeader(request, 'x-hugging-face-token')
    const payload = await fetchProviderCatalog(search, userToken, Number.isFinite(offset) ? offset : 0)

    response.statusCode = 200
    response.setHeader('Content-Type', 'application/json')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify(payload))
  } catch (error) {
    response.statusCode = 500
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({
      models: [],
      sources: [],
      errors: [error instanceof Error ? error.message : 'Provider catalog failed'],
    }))
  }
}

function readHeader(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}
