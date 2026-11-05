/**
 * Which hosts count as "LLM API" traffic.
 *
 * Sources, unioned:
 *  1. every `baseURL` of the `@deepseek-ai/dsh-llm-pi-ai` providers in the running loader tree
 *     (re-read on every lookup, so provider edits in Settings take effect immediately);
 *  2. the well-known endpoints of providers pi-ai serves from its built-in catalog without a
 *     baseURL in the profile;
 *  3. the user's own `llmHosts` list.
 */
import { unref } from './config.js'
import { normalizeHost } from './match.js'

/** Endpoints of catalog providers commonly used without an explicit baseURL. */
export const BUILTIN_LLM_HOSTS = [
  'api.deepseek.com',
  'api.anthropic.com',
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'openrouter.ai',
  'api.x.ai',
  'api.mistral.ai',
  'api.groq.com',
  'api.cerebras.ai',
  'api.moonshot.cn',
  'api.moonshot.ai',
  'open.bigmodel.cn',
  'dashscope.aliyuncs.com',
  'dashscope-intl.aliyuncs.com',
  'api.siliconflow.cn',
  'api.minimax.chat',
  'api.minimaxi.com',
  'models.github.ai',
  'api.githubcopilot.com',
  'api.together.xyz',
  'api.fireworks.ai',
  'ark.cn-beijing.volces.com',
]

const PI_AI = '@deepseek-ai/dsh-llm-pi-ai'

function isExpr(value) {
  return value !== null && typeof value === 'object' && '__jsExpr' in value
}

/**
 * Collect provider routes from the loader.
 * @returns {{ route: string, host: string }[]}
 */
export function providerRoutes(loader) {
  const out = []
  if (!loader || typeof loader.entries !== 'function') return out
  let entries
  try {
    entries = [...loader.entries()]
  } catch {
    return out
  }
  for (const entry of entries) {
    const options = entry?.options
    if (!options || options.name !== PI_AI || options.disabled === true) continue
    // Prefer the parsed running config; fall back to the raw entry options.
    const configs = [entry.fiber?.config, options.config]
    for (const config of configs) {
      const providers = unref(config?.providers)
      if (!providers || typeof providers !== 'object' || isExpr(providers)) continue
      for (const [route, provider] of Object.entries(providers)) {
        const baseURL = unref(unref(provider)?.baseURL)
        if (typeof baseURL !== 'string' || !baseURL) continue
        try {
          out.push({ route, host: normalizeHost(new URL(baseURL).hostname), baseURL })
        } catch {}
      }
      break
    }
  }
  return out
}

/**
 * Build a cached lookup returning the current LLM host list.
 * @param {() => any} getLoader
 * @param {{ llmHosts: string[], providers: string[], builtinHosts: boolean }} config
 */
export function createLlmHostSource(getLoader, config) {
  let cache
  let cachedAt = 0
  return () => {
    const now = Date.now()
    if (cache && now - cachedAt < 3000) return cache
    const only = new Set(config.providers)
    const routes = providerRoutes(getLoader()).filter((r) => only.size === 0 || only.has(r.route))
    const hosts = new Set(routes.map((r) => r.host))
    if (config.builtinHosts && only.size === 0) for (const h of BUILTIN_LLM_HOSTS) hosts.add(h)
    for (const h of config.llmHosts) hosts.add(String(h).trim().toLowerCase())
    hosts.delete('')
    cache = [...hosts]
    cachedAt = now
    return cache
  }
}

/**
 * The configured model endpoints (one per provider route), for the Plugins page's test panel.
 * @param {() => any} getLoader
 * @param {{ providers: string[] }} config
 */
export function providerEndpoints(getLoader, config) {
  const only = new Set(config?.providers ?? [])
  return providerRoutes(getLoader())
    .filter((r) => only.size === 0 || only.has(r.route))
    .filter((r) => typeof r.baseURL === 'string')
}
