/**
 * Lenient proxy input parser (SOCKS5 and HTTP/HTTPS proxies). Accepts whatever a proxy provider
 * or a tutorial hands out:
 *
 *   socks5h://user:pass@host:1080          socks5://host:1080
 *   http://user:pass@host:8080             https://host:443
 *   export ALL_PROXY=socks5://host:1080    set HTTPS_PROXY=http://host:3128
 *   curl --socks5-hostname host:1080 --proxy-user user:pass https://...
 *   curl -x http://user:pass@host:8080 ...  curl --proxy host:3128 -U user:pass ...
 *   host:1080          user:pass@host:1080          host:1080:user:pass      (→ SOCKS5)
 *
 * KEEP IN SYNC with the copy in client.js (the browser half cannot import Host files).
 */

const enc = (s) => encodeURIComponent(s)

/** Build the canonical URL: socks5h:// / socks5:// / http:// / https://. */
export function formatProxyUrl({ type = 'socks5', host, port, username = '', password = '', remoteDns = true }) {
  const auth = username ? `${enc(username)}${password ? `:${enc(password)}` : ''}@` : ''
  const h = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const scheme = type === 'http' || type === 'https' ? type : remoteDns ? 'socks5h' : 'socks5'
  return `${scheme}://${auth}${h}:${port}`
}

function validPort(p) {
  const n = Number(p)
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : undefined
}

const SCHEMES = { 'socks5:': 'socks5', 'socks5h:': 'socks5', 'socks:': 'socks5', 'http:': 'http', 'https:': 'https' }
const DEFAULT_PORTS = { socks5: 1080, http: 80, https: 443 }

function fromUrl(text) {
  let url
  try {
    url = new URL(text)
  } catch {
    return undefined
  }
  const proto = url.protocol.toLowerCase()
  const type = SCHEMES[proto]
  if (!type || !url.hostname) return undefined
  const port = validPort(url.port || DEFAULT_PORTS[type])
  if (!port) return undefined
  return {
    type,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port,
    username: url.username ? decodeURIComponent(url.username) : '',
    password: url.password ? decodeURIComponent(url.password) : '',
    remoteDns: proto !== 'socks5:',
  }
}

function fromHostPort(text, type, remoteDns) {
  let m = /^(?:([^:@\s]+)(?::([^@\s]*))?@)?(\[[^\]]+\]|[^:\s@/]+):(\d{1,5})\/?$/.exec(text)
  if (m) {
    const port = validPort(m[4])
    if (!port) return undefined
    return { type, host: m[3].replace(/^\[|\]$/g, ''), port, username: m[1] || '', password: m[2] || '', remoteDns }
  }
  // provider list style host:port:user:pass
  m = /^([^:\s@/]+):(\d{1,5}):([^:\s]+):(\S+)$/.exec(text)
  if (m) {
    const port = validPort(m[2])
    if (!port) return undefined
    return { type, host: m[1], port, username: m[3], password: m[4], remoteDns }
  }
  return undefined
}

/** A proxy value as curl or an *_PROXY variable takes it: a URL, or host:port meaning HTTP. */
function fromValue(value) {
  const v = value.replace(/^["']|["']$/g, '')
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? fromUrl(v) : fromHostPort(v, 'http', true)
}

/**
 * @param {string} input
 * @returns {{ url: string, type: 'socks5' | 'http' | 'https', host: string, port: number, username: string, password: string, remoteDns: boolean } | undefined}
 */
export function parseProxyInput(input) {
  const text = String(input == null ? '' : input).trim().replace(/^["']|["']$/g, '')
  if (!text) return undefined
  let parsed
  // 1. a socks URL anywhere (curl -x socks5h://…, ALL_PROXY=socks5://…)
  const socksUrl = /(socks5h?|socks):\/\/[^\s'"]+/i.exec(text)
  if (socksUrl) parsed = fromUrl(socksUrl[0].replace(/^SOCKS5?H?/i, (s) => s.toLowerCase()))
  // 2. curl -x / --proxy <value>
  if (!parsed) {
    const flag = /(?:^|\s)(?:-x|--proxy)[\s=]+(["']?[^\s"']+["']?)/.exec(text)
    if (flag) parsed = fromValue(flag[1])
  }
  // 3. HTTP_PROXY= / HTTPS_PROXY= / ALL_PROXY= assignments
  if (!parsed) {
    const env = /\b(?:https?|all)_proxy\s*=\s*(["']?[^\s"']+["']?)/i.exec(text)
    if (env) parsed = fromValue(env[1])
  }
  // 4. curl --socks5 / --socks5-hostname host:port
  if (!parsed) {
    const curl = /--socks5(-hostname)?[\s=]+(\S+)/.exec(text)
    if (curl) parsed = fromHostPort(curl[2], 'socks5', Boolean(curl[1]))
  }
  // 5. a single token: http(s):// URL, or host:port forms (SOCKS5, as before)
  if (!parsed && !/\s/.test(text)) parsed = /^https?:\/\//i.test(text) ? fromUrl(text) : fromHostPort(text, 'socks5', true)
  if (!parsed) return undefined
  const user = /(?:--proxy-user|-U)[\s=]+(\S+)/.exec(text)
  if (user && !parsed.username) {
    const i = user[1].indexOf(':')
    parsed.username = i < 0 ? user[1] : user[1].slice(0, i)
    parsed.password = i < 0 ? '' : user[1].slice(i + 1)
  }
  return Object.assign(parsed, { url: formatProxyUrl(parsed) })
}
