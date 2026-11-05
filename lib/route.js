/**
 * The one place that decides whether a URL goes through the proxy. Shared by the live router
 * and by the "测试连接" probe so both always answer the same thing.
 *
 * Modes:
 *  - "off": nothing is proxied.
 *  - "llm": only LLM API hosts go through the proxy; everything else keeps its original route.
 *  - "dsh": DSH's own outbound traffic (web_fetch, search, MCP, child processes, ...) goes
 *           through the proxy, but LLM API hosts do NOT (they stay direct).
 *  - "all": everything — DSH's own traffic plus LLM API ("dsh" + "llm").
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
    if (config.mode === 'dsh') {
      // DSH's own traffic is proxied, but LLM API hosts keep their direct/previous route.
      return !matchesHostList(llmHosts(), host, port)
    }
    if (config.mode === 'llm') return matchesHostList(llmHosts(), host, port)
    return false
  }
}
