import test from 'node:test'
import assert from 'node:assert/strict'
import { startKaggleOAuthLogin } from '../server/kaggleAuthService.mjs'

test('Kaggle OAuth start returns a clear error on serverless runtimes', async () => {
  const originalNetlify = process.env.NETLIFY
  process.env.NETLIFY = 'true'

  try {
    await assert.rejects(
      () => startKaggleOAuthLogin(true),
      (error) => {
        assert.equal(error.statusCode, 400)
        assert.match(error.message, /Kaggle OAuth login cannot run on Netlify serverless/)
        return true
      },
    )
  } finally {
    if (originalNetlify === undefined) delete process.env.NETLIFY
    else process.env.NETLIFY = originalNetlify
  }
})
