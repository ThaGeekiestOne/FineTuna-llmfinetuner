import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))

export function getRuntimeDir() {
  if (process.env.FINETUNA_RUNTIME_DIR) return resolve(process.cwd(), process.env.FINETUNA_RUNTIME_DIR)
  return resolve(currentDir, '../.runtime')
}

export function resolveRuntimePath(...segments) {
  return resolve(getRuntimeDir(), ...segments)
}
