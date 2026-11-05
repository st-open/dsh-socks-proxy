/**
 * "测试连接" probes. The live routing is never touched.
 *
 *  - probeSocks (alias probeUpstream): does the proxy server itself work? SOCKS5: TCP connect +
 *    greeting + login. HTTP(S): TCP/TLS connect + one request to an `.invalid` host, which shows
 *    whether the proxy answers HTTP and accepts the login. No tunnel, no website.
 *  - probeEndpoints: for each configured model endpoint, open the tunnel the plugin would
 *    actually use (through the proxy, or direct) and report whether it can be reached.
 */
import net from 'node:net'
import { checkUpstream, dialThrough } from './dial.js'
import { createRouteDecision, portOf } from './route.js'

/** Map a failure to a stable code the page translates. */
export function classify(error) {
  const message = String(error?.message ?? error)
  const code = error?.code ?? error?.cause?.code
  if (code === 'EAUTH' || /authentication failed/i.test(message)) return 'auth'
  if (code === 'EAUTHREQUIRED' || /requires username\/password/i.test(message)) return 'auth-required'
  if (/none of the offered/i.test(message)) return 'auth-unsupported'
  if (/answered with version|unexpected method/i.test(message)) return 'not-socks5'
  if (code === 'ENOTHTTP') return 'not-http-proxy'
  if (code === 'ECONNECTFAILED') return 'target-unreachable'
  if (/certificate|SSL|TLS|EPROTO/i.test(message) || /^(ERR_TLS|ERR_SSL|CERT_|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_)/.test(String(code))) return 'proxy-tls'
  if (code === 'ECONNREFUSED') return 'proxy-refused'
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'proxy-dns'
  if (code === 'ETIMEDOUT' || /timed out/i.test(message)) return error?.stage === 'handshake' ? 'handshake-timeout' : 'proxy-timeout'
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'proxy-unreachable'
  if (code === 'ECONNRESET' || /closed the connection/i.test(message)) return 'proxy-reset'
  return 'proxy-error'
}

/**
 * @param {{ host: string, port: number, username?: string, password?: string, timeoutMs?: number }} socks
 */
export async function probeSocks(socks) {
  const timeoutMs = Math.min(Math.max(Number(socks.timeoutMs) || 10000, 2000), 30000)
  const via = `${socks.host}:${socks.port}`
  const type = socks.type || 'socks5'
  try {
    const result = await checkUpstream({ ...socks, type, timeoutMs })
    return { ok: true, type, via, ...result, totalMs: result.tcpMs + result.handshakeMs }
  } catch (error) {
    return { ok: false, type, via, stage: error?.stage ?? 'tcp', code: classify(error), message: String(error?.message ?? error) }
  }
}
export const probeUpstream = probeSocks

function tcpReachable(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = net.connect({ host, port })
    const done = (result) => {
      socket.destroy()
      resolve({ ...result, ms: Date.now() - started })
    }
    socket.once('connect', () => done({ ok: true }))
    socket.once('error', (error) => done({ ok: false, code: error?.code, message: String(error?.message ?? error) }))
    socket.setTimeout(timeoutMs, () => done({ ok: false, code: 'ETIMEDOUT', message: `timed out after ${timeoutMs} ms` }))
  })
}

/**
 * Reach every configured model endpoint the way the current settings would send it.
 *
 * @param {object} config - normalized plugin config.
 * @param {{ route: string, baseURL: string }[]} endpoints
 * @param {() => string[]} [llmHosts]
 * @returns {Promise<{ route: string, baseURL: string, host: string, port: string, via: 'proxy' | 'direct', ok: boolean, ms: number, code?: string, message?: string }[]>}
 */
export async function probeEndpoints(config, endpoints, llmHosts = () => []) {
  const decision = createRouteDecision(config, llmHosts)
  const results = []
  for (const endpoint of endpoints.slice(0, 12)) {
    let url
    try {
      url = new URL(endpoint.baseURL)
    } catch {
      continue
    }
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const port = portOf(url)
    const via = decision(url) ? 'proxy' : 'direct'
    let outcome
    if (via === 'proxy') {
      const started = Date.now()
      try {
        const { socket } = await dialThrough({ ...config.socks, timeoutMs: Math.min(config.socks.timeoutMs, 8000) }, host, Number(port))
        socket.destroy()
        outcome = { ok: true, ms: Date.now() - started }
      } catch (error) {
        outcome = { ok: false, ms: Date.now() - started, code: classify(error), message: String(error?.message ?? error) }
      }
    } else {
      outcome = await tcpReachable(host, Number(port), 5000)
    }
    results.push({ route: endpoint.route, baseURL: endpoint.baseURL, host, port, via, ...outcome })
  }
  return results
}
