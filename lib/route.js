/**
 * The one place that decides whether a URL goes through the proxy. Shared by the live router
 * and by the "测试连接" probe so both always answer the same thing.
 */
import { isLoopback, isPrivateLiteral, matchesHostList, normalizeHost } from './match.js'

export function portOf(url) {
  if (url.port) return url.port
  return url.protocol === 'https:' || url.protocol === 'wss:' ? '443' : '80'
}

/**
 * @param {{ mode: string, bypassPrivate: boolean, bypass: string[] }} config
 * @param {() => string[]} llmHosts
 * @returns {(url: URL) => boolean}
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
