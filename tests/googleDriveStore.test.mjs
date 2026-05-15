import test from 'node:test'
import assert from 'node:assert/strict'
import { getGoogleDriveConnection } from '../server/googleDriveStore.mjs'

test('Google Drive local fallback is blocked on serverless runtimes', async () => {
  const originalNetlify = process.env.NETLIFY
  const originalUrl = process.env.VITE_SUPABASE_URL
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  process.env.NETLIFY = 'true'
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY

  try {
    await assert.rejects(
      () => getGoogleDriveConnection('user-1', ''),
      (error) => {
        assert.equal(error.statusCode, 400)
        assert.match(error.message, /Google Drive needs Supabase storage on Netlify/)
        return true
      },
    )
  } finally {
    if (originalNetlify === undefined) delete process.env.NETLIFY
    else process.env.NETLIFY = originalNetlify
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL
    else process.env.VITE_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey
  }
})
