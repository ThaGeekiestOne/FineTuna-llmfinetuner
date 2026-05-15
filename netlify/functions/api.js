import { ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { dispatchApiRoute } from '../../server/routes/router.mjs'

export async function handler(event) {
  const request = buildRequest(event)
  const response = new NetlifyResponse(request)
  const handled = await dispatchApiRoute(request, response)

  if (!handled) {
    response.statusCode = 404
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ error: 'API route not found' }))
  }

  return response.toNetlifyResponse()
}

function buildRequest(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8')
  const request = Readable.from(body)
  request.method = event.httpMethod
  request.url = event.rawUrl ?? `https://${event.headers.host}${event.path}${event.rawQuery ? `?${event.rawQuery}` : ''}`
  request.headers = normalizeHeaders(event.headers)
  return request
}

function normalizeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

class NetlifyResponse extends ServerResponse {
  chunks = []

  constructor(request) {
    super(request)
  }

  write(chunk, encoding, callback) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
    if (callback) callback()
    return true
  }

  end(chunk, encoding, callback) {
    if (chunk) this.write(chunk, encoding)
    if (callback) callback()
    this.emit('finish')
    return this
  }

  toNetlifyResponse() {
    const headers = {}
    for (const [key, value] of Object.entries(this.getHeaders())) {
      if (Array.isArray(value)) headers[key] = value.map(String)
      else if (value !== undefined) headers[key] = String(value)
    }

    return {
      statusCode: this.statusCode || 200,
      headers,
      body: Buffer.concat(this.chunks).toString('utf8'),
    }
  }
}
