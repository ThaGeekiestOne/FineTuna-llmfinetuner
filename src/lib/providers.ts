import type { ModelCard } from './catalog'

export type ProviderCatalogResult = {
  models: ModelCard[]
  sources: string[]
  errors: string[]
}

export async function fetchProviderCatalog(search: string, token?: string, offset = 0): Promise<ProviderCatalogResult> {
  const params = new URLSearchParams()
  if (search.trim()) params.set('search', search.trim())
  if (offset > 0) params.set('offset', String(offset))
  const response = await fetch(`/api/models?${params.toString()}`, {
    headers: token?.trim() ? { 'x-hugging-face-token': token.trim() } : undefined,
  })
  if (!response.ok) throw new Error(`Provider catalog failed with ${response.status}`)
  return (await response.json()) as ProviderCatalogResult
}
