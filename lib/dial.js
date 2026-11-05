/**
 * One entry point for "open a tunnel through the upstream proxy", whatever its kind.
 *
 * Upstream settings: `{ type: 'socks5' | 'http' | 'https', host, port, username?, password?,
 * remoteDns?, timeoutMs? }`. `remoteDns` only matters for SOCKS5: an HTTP proxy always resolves
 * the destination itself.
 */
import { httpConnect, httpProxyCheck } from './http-connect.js'
import { socks5Check, socks5Connect } from './socks5.js'

export const PROXY_TYPES = ['socks5', 'http', 'https']

export function isHttpUpstream(upstream) {
  return upstream?.type === 'http' || upstream?.type === 'https'
}

/** @returns {Promise<{ socket: import('node:net').Socket, head: Buffer }>} */
export function dialThrough(upstream, host, port, signal) {
  return isHttpUpstream(upstream) ? httpConnect(upstream, host, port, signal) : socks5Connect(upstream, host, port, signal)
}

/** Check the proxy server itself (no destination is contacted). */
export function checkUpstream(upstream) {
  return isHttpUpstream(upstream) ? httpProxyCheck(upstream) : socks5Check(upstream)
}

/** Human label used in logs: `SOCKS5 10.0.0.1:1080`, `HTTP proxy.example.com:8080`. */
export function describeUpstream(upstream) {
  const kind = upstream.type === 'https' ? 'HTTPS' : upstream.type === 'http' ? 'HTTP' : 'SOCKS5'
  return `${kind} ${upstream.host}:${upstream.port}`
}
