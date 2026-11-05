/**
 * Load packages that ship inside the running DSH installation (undici, @deepseek-ai/dsh-http-proxy)
 * without declaring them as dependencies.
 *
 * Importing DSH's own copy matters for dsh-http-proxy: its proxy policy is module state, so only
 * the very instance the launcher installed is the one web_fetch and child spawns consult.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

function anchors() {
  // The launcher's own location first, so we land on the exact copy DSH itself imported.
  const list = []
  if (process.env.DSH_SOCKS_PROXY_RUNTIME_DIR) list.push(process.env.DSH_SOCKS_PROXY_RUNTIME_DIR)
  for (const arg of process.argv.slice(1)) {
    if (typeof arg === 'string' && path.isAbsolute(arg)) list.push(arg)
  }
  try {
    list.push(path.dirname(fileURLToPath(import.meta.url)))
  } catch {}
  return list
}

function pickExport(entry) {
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    for (const key of ['node', 'import', 'default', 'require']) {
      const picked = pickExport(entry[key])
      if (picked) return picked
    }
  }
  return undefined
}

/** Find `node_modules/<name>` walking up from each anchor; returns the package entry file path. */
export function locateHostPackage(name) {
  const seen = new Set()
  for (const anchor of anchors()) {
    let dir = anchor
    while (true) {
      if (!seen.has(dir)) {
        seen.add(dir)
        const manifestPath = path.join(dir, 'node_modules', ...name.split('/'), 'package.json')
        try {
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            const exp = manifest.exports
            const rel = pickExport(exp && typeof exp === 'object' && '.' in exp ? exp['.'] : exp) ?? manifest.module ?? manifest.main ?? 'index.js'
            return path.join(path.dirname(manifestPath), rel)
          }
        } catch {}
      }
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return undefined
}

/** Import a package from the DSH installation; throws when it cannot be found. */
export async function importHostPackage(name) {
  const file = locateHostPackage(name)
  if (file) return await import(pathToFileURL(file).href)
  try {
    return await import(name)
  } catch {
    throw new Error(`cannot locate ${name} in the DSH installation`)
  }
}
