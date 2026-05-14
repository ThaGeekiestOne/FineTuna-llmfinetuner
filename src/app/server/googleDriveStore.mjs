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

  if (!existsSync(getConnectionFile())) return true
  await rm(getConnectionFile(), { force: true })
  return true
}

function validateGoogleDriveConnection(connection) {
  if (!connection || typeof connection !== 'object') throw new Error('Invalid Google Drive connection payload')
  if (!connection.refreshToken) throw new Error('Google Drive refresh token is required')
}
