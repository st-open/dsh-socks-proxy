/** Host matching helpers shared by both modes. */
import net from 'node:net'

export function normalizeHost(hostname) {
  return String(hostname).replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
}

export function isLoopback(hostname) {
  const host = normalizeHost(hostname)
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1' || host === '::' || host === '0.0.0.0') return true
  const v4 = host.startsWith('::ffff:') ? host.slice(7) : host
  return net.isIPv4(v4) && v4.startsWith('127.')
}

/** RFC 1918 / link-local / ULA literals: LAN services a remote SOCKS server usually cannot reach. */
export function isPrivateLiteral(hostname) {
  const host = normalizeHost(hostname)
  const v4 = host.startsWith('::ffff:') ? host.slice(7) : host
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number)
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 127
  }
  if (net.isIPv6(host)) return /^f[cd]/.test(host) || /^fe[89ab]/.test(host)
  return false
}

/**
 * Whether `hostname` matches one entry of a host list. `example.com` also matches its subdomains,
 * `*.example.com` / `.example.com` mean the same, `*` matches everything, and `10.` style
 * prefixes ending with a dot match IPv4 literals by prefix.
 */
export function matchesHostList(list, hostname, port) {
  const host = normalizeHost(hostname)
  for (const raw of list) {
    let entry = String(raw).trim().toLowerCase()
    if (!entry) continue
    if (entry === '*') return true
    let entryPort
    const portMatch = /^(.*[^:]):(\d+)$/.exec(entry)
    if (portMatch && !entry.includes('::')) {
      entry = portMatch[1]
      entryPort = portMatch[2]
    }
    if (entryPort !== undefined && String(port) !== entryPort) continue
    if (/^\d+(\.\d+){0,3}\.$/.test(entry)) {
      if (net.isIPv4(host) && host.startsWith(entry)) return true
      continue
    }
    entry = entry.replace(/^\*?\./, '').replace(/^\[|\]$/g, '')
    if (host === entry || host.endsWith(`.${entry}`)) return true
  }
  return false
}
