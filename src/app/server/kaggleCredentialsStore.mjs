import { mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { decryptJsonPayload, encryptJsonPayload, loadEncryptedJson, saveEncryptedJson } from './secureStore.mjs'
import { resolveRuntimePath } from './runtimePaths.mjs'
import { selectRows, shouldUseSupabaseData, upsertRow } from './supabaseRest.mjs'

function getKaggleDir() {
  return resolveRuntimePath('kaggle')
}

function getCredentialsFile() {
  return resolve(getKaggleDir(), 'credentials.enc.json')
}

export async function saveKaggleCredentials(credentials, userId = '', accessToken = '') {
  validateCredentials(credentials)
  if (shouldUseSupabaseData(accessToken) && userId) {
    const payload = await encryptJsonPayload(credentials)
    await upsertRow({
      table: 'provider_credentials',
      accessToken,
      onConflict: 'user_id,provider',
      row: {
        user_id: userId,
        provider: 'kaggle',
        payload,
        updated_at: new Date().toISOString(),
      },
    })
    return
  }
  await saveEncryptedJson(getCredentialsFile(), credentials)
}

export async function getKaggleCredentials(userId = '', accessToken = '') {
  if (shouldUseSupabaseData(accessToken) && userId) {
    const rows = await selectRows({
      table: 'provider_credentials',
      accessToken,
      filters: { user_id: userId, provider: 'kaggle' },
      limit: 1,
    })
    if (!rows[0]?.payload) return null
    return decryptJsonPayload(rows[0].payload)
  }
  return loadEncryptedJson(getCredentialsFile())
}

export async function hasKaggleCredentials(userId = '', accessToken = '') {
  if (shouldUseSupabaseData(accessToken) && userId) {
    return Boolean(await getKaggleCredentials(userId, accessToken))
  }
  return existsSync(getCredentialsFile())
}

export async function createKaggleConfigDir(userId = '', accessToken = '') {
  const credentials = await getKaggleCredentials(userId, accessToken)
  if (!credentials) {
    const error = new Error('Kaggle credentials are not configured')
    error.statusCode = 400
    throw error
  }

  const configDir = resolve(getKaggleDir(), `session-${Date.now().toString(36)}`)
  await mkdir(configDir, { recursive: true })
  await writeFile(resolve(configDir, 'kaggle.json'), JSON.stringify(credentials, null, 2))
  return {
    credentials,
    configDir,
    cleanup: async () => rm(configDir, { recursive: true, force: true }),
  }
}

function validateCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') throw new Error('Invalid Kaggle credentials')
  if (!credentials.username || !credentials.key) throw new Error('Kaggle credentials require username and key')
}
