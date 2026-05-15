import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { decryptJsonPayload, encryptJsonPayload, loadEncryptedJson, saveEncryptedJson } from './secureStore.mjs'
import { resolveRuntimePath } from './runtimePaths.mjs'
import { deleteRows, selectRows, shouldUseSupabaseData, upsertRow } from './supabaseRest.mjs'

const provider = 'google_drive'

function getGoogleDriveDir() {
  return resolveRuntimePath('google-drive')
}

function getConnectionFile() {
  return resolve(getGoogleDriveDir(), 'connection.enc.json')
}

export async function saveGoogleDriveConnection(connection, userId = '', accessToken = '') {
  validateGoogleDriveConnection(connection)
  ensurePersistentStorage(userId, accessToken)
  if (shouldUseSupabaseData(accessToken) && userId) {
    const payload = await encryptJsonPayload(connection)
    await upsertRow({
      table: 'provider_credentials',
      accessToken,
      onConflict: 'user_id,provider',
      row: {
        user_id: userId,
        provider,
        payload,
        updated_at: new Date().toISOString(),
      },
    })
    return connection
  }

  await mkdir(getGoogleDriveDir(), { recursive: true })
  await saveEncryptedJson(getConnectionFile(), connection)
  return connection
}

export async function getGoogleDriveConnection(userId = '', accessToken = '') {
  if (shouldUseSupabaseData(accessToken) && userId) {
    const rows = await selectRows({
      table: 'provider_credentials',
      accessToken,
      filters: { user_id: userId, provider },
      limit: 1,
    })
    if (!rows[0]?.payload) return null
    return decryptJsonPayload(rows[0].payload)
  }

  ensurePersistentStorage(userId, accessToken)
  return loadEncryptedJson(getConnectionFile())
}

export async function deleteGoogleDriveConnection(userId = '', accessToken = '') {
  if (shouldUseSupabaseData(accessToken) && userId) {
    await deleteRows({
      table: 'provider_credentials',
      accessToken,
      filters: { user_id: userId, provider },
    })
    return true
  }

  ensurePersistentStorage(userId, accessToken)
  if (!existsSync(getConnectionFile())) return true
  await rm(getConnectionFile(), { force: true })
  return true
}

function ensurePersistentStorage(userId, accessToken) {
  if (!isServerlessRuntime()) return
  if (shouldUseSupabaseData(accessToken) && userId) return

  const error = new Error('Google Drive needs Supabase storage on Netlify. Make sure you are signed in and that the provider_credentials table from docs/supabase-schema.sql exists.')
  error.statusCode = 400
  throw error
}

function isServerlessRuntime() {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT)
}

function validateGoogleDriveConnection(connection) {
  if (!connection || typeof connection !== 'object') throw new Error('Invalid Google Drive connection payload')
  if (!connection.refreshToken) throw new Error('Google Drive refresh token is required')
}
