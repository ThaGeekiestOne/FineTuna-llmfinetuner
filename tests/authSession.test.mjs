import test from 'node:test'
import assert from 'node:assert/strict'
import { readAuthenticatedUser } from '../server/authSession.mjs'

test('resolves Supabase sessions from bearer tokens when cookies are unavailable', async () => {
  const originalFetch = global.fetch
  const originalUrl = process.env.VITE_SUPABASE_URL
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-key'

  try {
    global.fetch = async (url, init) => {
      assert.equal(url, 'https://example.supabase.co/auth/v1/user')
      assert.equal(init.headers.Authorization, 'Bearer access-token')
      return new Response(JSON.stringify({
        id: 'user-1',
        email: 'user@example.com',
        user_metadata: { name: 'Test User' },
        created_at: '2026-01-01T00:00:00.000Z',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const setHeaders = {}
    const session = await readAuthenticatedUser({
      headers: {
        authorization: 'Bearer access-token',
        'x-finetuna-refresh-token': 'refresh-token',
      },
    }, {
      setHeader(name, value) {
        setHeaders[name] = value
      },
    })

    assert.equal(session.provider, 'supabase')
    assert.equal(session.user.email, 'user@example.com')
    assert.ok(setHeaders['Set-Cookie'].some((cookie) => cookie.startsWith('finetuna_sb_access=')))
    assert.ok(setHeaders['Set-Cookie'].some((cookie) => cookie.startsWith('finetuna_sb_refresh=')))
  } finally {
    global.fetch = originalFetch
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey
  }
})
