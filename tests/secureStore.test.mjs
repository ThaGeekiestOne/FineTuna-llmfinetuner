import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptJsonPayload, encryptJsonPayload } from '../server/secureStore.mjs'

test('secure store encrypts and decrypts payloads with Web Crypto', async () => {
  const originalKey = process.env.FINETUNA_ENCRYPTION_KEY
  process.env.FINETUNA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')

  try {
    const envelope = await encryptJsonPayload({ refreshToken: 'drive-refresh-token' })
    assert.equal(typeof envelope.iv, 'string')
    assert.equal(typeof envelope.tag, 'string')
    assert.equal(typeof envelope.data, 'string')
    assert.deepEqual(await decryptJsonPayload(envelope), { refreshToken: 'drive-refresh-token' })
  } finally {
    if (originalKey === undefined) delete process.env.FINETUNA_ENCRYPTION_KEY
    else process.env.FINETUNA_ENCRYPTION_KEY = originalKey
  }
})
