import { Readable, Writable } from 'node:stream'

export async function handler(event) {
  try {
    const request = buildRequest(event)
    const response = new NetlifyResponse()
    const handled = await dispatchApiRoute(request, response)

    if (!handled) {
      response.statusCode = 404
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ error: 'API route not found' }))
    }

    await response.done()
    return response.toNetlifyResponse()
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Netlify API function failed' }),
    }
  }
}

async function dispatchApiRoute(request, response) {
  const router = await import('../../server/routes/router.mjs')
  return router.dispatchApiRoute(request, response)
}

function buildRequest(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64')
    : Buffer.from(event.body ?? '', 'utf8')
  const request = Readable.from(body)
  request.method = event.httpMethod
  request.url = buildRequestUrl(event)
  request.headers = normalizeHeaders(event.headers)
  return request
}

function buildRequestUrl(event) {
  const protocol = event.headers?.['x-forwarded-proto'] ?? 'https'
  const host = event.headers?.host ?? new URL(event.rawUrl ?? 'https://finetuna.netlify.app').host
  const path = normalizePath(event.path ?? new URL(event.rawUrl ?? `https://${host}/api`).pathname)
  const query = buildQueryString(event)
  return `${protocol}://${host}${path}${query ? `?${query}` : ''}`
}

function normalizePath(path) {
  const functionPrefix = '/.netlify/functions/api'
  if (path === functionPrefix) return '/api'
  if (path.startsWith(`${functionPrefix}/`)) return `/api/${path.slice(`${functionPrefix}/`.length)}`
  return path
}

function buildQueryString(event) {
  if (event.rawQuery) return event.rawQuery
  if (event.rawUrl) {
    const search = new URL(event.rawUrl).search
    if (search) return search.slice(1)
  }
  return new URLSearchParams(event.queryStringParameters ?? {}).toString()
}

function normalizeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
}

class NetlifyResponse extends Writable {
  constructor() {
    super()
    this.statusCode = 200
    this.headers = new Map()
    this.headerNames = new Map()
    this.chunks = []
    this.finished = new Promise((resolve, reject) => {
      this.on('finish', resolve)
      this.on('error', reject)
    })
  }

  setHeader(name, value) {
    const key = String(name).toLowerCase()
    this.headerNames.set(key, String(name))
    this.headers.set(key, value)
    return this
  }

  getHeader(name) {
    return this.headers.get(String(name).toLowerCase())
  }

  getHeaders() {
    return Object.fromEntries(
      Array.from(this.headers.entries()).map(([key, value]) => [this.headerNames.get(key) ?? key, value]),
    )
  }

  removeHeader(name) {
    const key = String(name).toLowerCase()
    this.headers.delete(key)
    this.headerNames.delete(key)
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode
    for (const [key, value] of Object.entries(headers)) {
      this.setHeader(key, value)
    }
    return this
  }

  _write(chunk, encoding, callback) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding))
    callback()
  }

  toNetlifyResponse() {
    const headers = {}
    const multiValueHeaders = {}
    for (const [key, value] of Object.entries(this.getHeaders())) {
      if (Array.isArray(value)) multiValueHeaders[key] = value.map(String)
      else if (value !== undefined) headers[key] = String(value)
    }

    const bodyBuffer = Buffer.concat(this.chunks)
    const contentType = String(this.getHeader('content-type') ?? '')
    const isBinary = contentType.toLowerCase().startsWith('application/octet-stream')

    return {
      statusCode: this.statusCode || 200,
      headers,
      ...(Object.keys(multiValueHeaders).length > 0 ? { multiValueHeaders } : {}),
      body: bodyBuffer.toString(isBinary ? 'base64' : 'utf8'),
      ...(isBinary ? { isBase64Encoded: true } : {}),
    }
  }

  done() {
    if (this.writableEnded) return Promise.resolve()
    return this.finished
  }
}
