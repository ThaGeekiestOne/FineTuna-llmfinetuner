import test from 'node:test'
import assert from 'node:assert/strict'
import { handler } from '../netlify/functions/api.mjs'

test('Netlify API function routes auth session requests', async () => {
  const response = await handler({
    httpMethod: 'GET',
    path: '/api/auth/session',
    rawUrl: 'https://finetuna.netlify.app/api/auth/session',
    headers: { host: 'finetuna.netlify.app' },
    body: '',
    isBase64Encoded: false,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).authenticated, false)
})

test('Netlify API function normalizes redirected function paths', async () => {
  const response = await handler({
    httpMethod: 'GET',
    path: '/.netlify/functions/api/auth/session',
    rawUrl: 'https://finetuna.netlify.app/.netlify/functions/api/auth/session',
    headers: { host: 'finetuna.netlify.app' },
    body: '',
    isBase64Encoded: false,
  })

  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).authenticated, false)
})
