export async function fetchProviderCatalog(search = '', userToken = '', offset = 0) {
  const token = userToken || process.env.HUGGING_FACE_TOKEN || ''
  const pageSize = 100
  const fetchLimit = Math.min(500, offset + pageSize)
  const models = dedupeModels(await fetchHuggingFaceModels(search, token, fetchLimit))
  return { models: models.slice(offset, offset + pageSize), sources: ['Hugging Face'], errors: [] }
}

async function fetchHuggingFaceModels(search, token, limit) {
  const params = new URLSearchParams({
    pipeline_tag: 'text-generation',
    sort: 'downloads',
    direction: '-1',
    limit: String(limit),
    full: 'true',
  })

  if (search.trim()) params.set('search', search.trim())

  const response = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
    headers: token.trim() ? { Authorization: `Bearer ${token.trim()}` } : undefined,
  })

  if (!response.ok) throw new Error(`External catalog request failed with ${response.status}`)

  const payload = await response.json()
  return payload.map(mapHuggingFaceModel).filter((model) => model.name)
}

export function mapHuggingFaceModel(model) {
  const name = model.modelId ?? model.id ?? 'Unknown model'
  const tags = model.tags ?? []
  return {
    id: `hf:${name}`,
    name,
    architecture: inferArchitecture(name, tags),
    parameters: inferParameters(name, tags),
    vram: inferVram(name, tags),
    license: model.cardData?.license ?? findLicense(tags) ?? 'Model card',
    downloads: formatDownloads(model.downloads ?? 0),
    rating: estimateRating(model.likes ?? 0, model.downloads ?? 0),
    tags: ['hugging-face', model.pipeline_tag ?? 'text-generation', ...tags.slice(0, 3)],
    author: model.author ?? inferAuthor(name),
    releasedAt: formatDate(model.createdAt),
    lastModified: formatDate(model.lastModified),
    gated: Boolean(model.gated),
    providerUrl: `https://huggingface.co/${name}`,
  }
}

function dedupeModels(models) {
  const seen = new Set()
  return models.filter((model) => {
    if (seen.has(model.id)) return false
    seen.add(model.id)
    return true
  })
}

function inferArchitecture(name, tags) {
  const haystack = `${name} ${tags.join(' ')}`.toLowerCase()
  if (haystack.includes('mistral') || haystack.includes('mixtral')) return 'Mistral'
  if (haystack.includes('llama')) return 'Llama'
  if (haystack.includes('phi')) return 'Phi'
  if (haystack.includes('gemma')) return 'Gemma'
  if (haystack.includes('qwen')) return 'Qwen'
  if (haystack.includes('falcon')) return 'Falcon'
  return 'Other'
}

function inferParameters(name, tags = []) {
  const haystack = `${name} ${tags.join(' ')}`
  const match = haystack.match(/(\d+(?:\.\d+)?)\s?([bBmM])(?:-|_|:|$|\s)/)
  if (!match) return 'Unknown'
  return `${match[1]}${match[2].toUpperCase()}`
}

function inferVram(name, tags) {
  const params = inferParameters(name, tags)
  if (params.endsWith('M')) return '4-6 GB'
  const value = Number(params.replace('B', ''))
  if (!Number.isFinite(value)) return 'Check model card'
  if (value <= 4) return '8 GB'
  if (value <= 8) return '16 GB'
  if (value <= 14) return '24 GB'
  return '40 GB+'
}

function findLicense(tags) {
  const license = tags.find((tag) => tag.startsWith('license:'))
  return license?.replace('license:', '')
}

function inferAuthor(name) {
  return name.includes('/') ? name.split('/')[0] : 'Community'
}

function formatDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

function formatDownloads(downloads) {
  if (downloads >= 1_000_000) return `${(downloads / 1_000_000).toFixed(1)}M`
  if (downloads >= 1_000) return `${(downloads / 1_000).toFixed(1)}K`
  return String(downloads)
}

function estimateRating(likes, downloads) {
  const engagement = downloads > 0 ? Math.min(1, likes / Math.max(100, downloads * 0.005)) : 0
  return Number((4 + engagement).toFixed(1))
}
