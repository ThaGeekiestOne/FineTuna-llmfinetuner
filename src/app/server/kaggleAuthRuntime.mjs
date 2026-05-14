import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { resolveRuntimePath } from './runtimePaths.mjs'

export function getKaggleOAuthHome() {
  return resolveRuntimePath('kaggle-oauth-home')
}

export function getKaggleOAuthCredentialsFile() {
  return resolve(getKaggleOAuthHome(), '.kaggle', 'credentials.json')
}

export async function getKaggleOAuthStatus() {
  const credentialsFile = getKaggleOAuthCredentialsFile()
  if (!existsSync(credentialsFile)) {
    return {
      configured: false,
      username: null,
      scopes: [],
      authMethod: 'oauth',
    }
  }

  try {
    const parsed = JSON.parse(await readFile(credentialsFile, 'utf8'))
    return {
      configured: Boolean(parsed.refresh_token),
      username: parsed.username || null,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [],
      authMethod: 'oauth',
    }
  } catch {
    return {
      configured: false,
      username: null,
      scopes: [],
      authMethod: 'oauth',
    }
  }
}

export function hasKaggleOAuthCredentials() {
  return existsSync(getKaggleOAuthCredentialsFile())
}

export function buildKaggleOAuthEnv() {
  const home = getKaggleOAuthHome()
  return {
    HOME: home,
    USERPROFILE: home,
  }
}
