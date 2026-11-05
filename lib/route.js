/**
 * The one place that decides, for a URL, whether it is proxied at all and — when it is — which
 * upstream it uses. Shared by the live router, the bridge routing and the "测试连接" probe so all
 * of them always answer the same thing.
 */
import { isLoopback, isPrivateLiteral, matchesHostList, normalizeHost } from './match.js'

export function portOf(url) {
  if (url.port) return url.port
  return url.protocol === 'https:' || url.protocol === 'wss:' ? '443' : '80'
}

/**
 * @param {{ mode: string, bypassPrivate: boolean, bypass: string[], secondEnabled?: boolean, secondHosts?: string[] }} config
 * @param {() => string[]} llmHosts
 * @returns {(url: URL) => boolean} true when the URL should be proxied (by either upstream)
 */
export function createRouteDecision(config, llmHosts = () => []) {
  return (url) => {
    const host = normalizeHost(url.hostname)
    const port = portOf(url)
    // Loopback is never proxied: the Web UI, the connection transport and local test servers.
    if (isLoopback(host)) return false
    if (config.bypassPrivate && isPrivateLiteral(host)) return false
    if (matchesHostList(config.bypass, host, port)) return false
    if (config.mode === 'all') return true
    if (config.mode !== 'llm') return false
    return matchesHostList(llmHosts(), host, port)
  }
}

/**
 * Which upstream a proxied URL uses: `'second'` when the second upstream is enabled and the host
 * matches its `secondHosts` list, else `'primary'`. Callers apply it only after a proxied decision.
 *
 * @param {{ secondEnabled?: boolean, secondHosts?: string[] }} config
 * @returns {(url: URL) => 'primary' | 'second'}
 */
export function createUpstreamDecision(config) {
  const secondHosts = config.secondEnabled ? config.secondHosts ?? [] : []
  return (url) => {
    if (!secondHosts.length) return 'primary'
    const host = normalizeHost(url.hostname)
    const port = portOf(url)
    return matchesHostList(secondHosts, host, port) ? 'second' : 'primary'
  }
}
