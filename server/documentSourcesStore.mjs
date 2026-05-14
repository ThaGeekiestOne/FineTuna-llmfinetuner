import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { selectRows, shouldUseSupabaseData, upsertRow } from './supabaseRest.mjs'
import { resolveRuntimePath } from './runtimePaths.mjs'

function getDocumentSourcesFile() {
  return resolve(resolveRuntimePath('documents'), 'sources.json')
}

export async function listDocumentSources(userId = '', accessToken = '') {
  if (shouldUseSupabaseData(accessToken) && userId) {
    const rows = await selectRows({
      table: 'document_sources',
      accessToken,
      filters: { user_id: userId },
      orderBy: 'updated_at.desc',
    })
    return rows.map(mapRowToSource)
  }

  const store = await readLocalStore()
  return store.sources.filter((source) => source.userId === userId || !userId)
}

export async function saveDocumentSources(sources, userId = '', accessToken = '') {
  const normalized = normalizeSources(sources)
  if (shouldUseSupabaseData(accessToken) && userId) {
    for (const source of normalized) {
      await upsertRow({
        table: 'document_sources',
        accessToken,
        onConflict: 'user_id,provider,external_id',
        row: {
          user_id: userId,
          provider: source.provider,
          external_id: source.externalId,
          name: source.name,
          mime_type: source.mimeType,
          size_bytes: source.sizeBytes,
          modified_at: source.modifiedAt,
          web_view_link: source.webViewLink,
          metadata: source.metadata,
          updated_at: new Date().toISOString(),
        },
      })
    }
    return listDocumentSources(userId, accessToken)
  }

  const store = await readLocalStore()
  const byKey = new Map(store.sources.map((source) => [`${source.provider}:${source.externalId}`, source]))
  for (const source of normalized) {
    byKey.set(`${source.provider}:${source.externalId}`, { ...source, userId })
  }
  store.sources = [...byKey.values()]
  await writeLocalStore(store)
  return store.sources.filter((source) => source.userId === userId || !userId)
}

function normalizeSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('At least one document source is required')
  }

  return sources.map((source) => {
    if (!source || typeof source !== 'object') throw new Error('Invalid document source')
    if (!source.provider || !source.externalId || !source.name) {
      throw new Error('Document sources require provider, externalId, and name')
    }
    return {
      provider: String(source.provider),
      externalId: String(source.externalId),
      name: String(source.name),
      mimeType: String(source.mimeType ?? ''),
      sizeBytes: Number(source.sizeBytes ?? 0),
      modifiedAt: source.modifiedAt ? String(source.modifiedAt) : null,
      webViewLink: String(source.webViewLink ?? ''),
      metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {},
    }
  })
}

async function readLocalStore() {
  const path = getDocumentSourcesFile()
  if (!existsSync(path)) return { sources: [] }
  return JSON.parse(await readFile(path, 'utf8'))
}

async function writeLocalStore(store) {
  const path = getDocumentSourcesFile()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(store, null, 2))
}

function mapRowToSource(row) {
  return {
    provider: row.provider,
    externalId: row.external_id,
    name: row.name,
    mimeType: row.mime_type ?? '',
    sizeBytes: Number(row.size_bytes ?? 0),
    modifiedAt: row.modified_at ?? null,
    webViewLink: row.web_view_link ?? '',
    metadata: row.metadata ?? {},
  }
}
