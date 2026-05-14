import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const runtimeDir = resolve(process.cwd(), '.test-runtime/kaggle-oauth')
process.env.FINETUNA_RUNTIME_DIR = '.test-runtime/kaggle-oauth'

const {
  buildKaggleOAuthEnv,
  getKaggleOAuthCredentialsFile,
  getKaggleOAuthStatus,
  hasKaggleOAuthCredentials,
} = await import('../server/kaggleAuthRuntime.mjs')

test.after(async () => {
  if (existsSync(runtimeDir)) await rm(runtimeDir, { recursive: true, force: true })
})

test('reads Kaggle OAuth credentials from the runtime home', async () => {
  const credentialsFile = getKaggleOAuthCredentialsFile()
  await mkdir(dirname(credentialsFile), { recursive: true })
  await writeFile(credentialsFile, JSON.stringify({
    refresh_token: 'refresh-token',
    access_token: 'access-token',
    username: 'oauth-user',
    scopes: ['resources.admin:*'],
  }, null, 2))

  const status = await getKaggleOAuthStatus()
  const env = buildKaggleOAuthEnv()

  assert.equal(hasKaggleOAuthCredentials(), true)
  assert.equal(status.configured, true)
  assert.equal(status.username, 'oauth-user')
  assert.equal(env.HOME.endsWith('kaggle-oauth-home'), true)
})
