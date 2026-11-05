/** Config normalization: plain JS, no schema library needed. */
import { parseProxyInput } from './parse-proxy.js'

export const MODES = ['off', 'llm', 'dsh', 'all']
export const PROXY_TYPES = ['socks5', 'http', 'https']

export const DEFAULTS = {
  mode: 'llm',
  proxy: '',
  socks: {
    type: 'socks5',
    host: '127.0.0.1',
    port: 7890,
    username: '',
    password: '',
    passwordEnv: '',
    remoteDns: true,
    timeoutMs: 15000,
  },
  llmHosts: [],
  providers: [],
  builtinHosts: true,
  bypass: [],
  bypassPrivate: true,
  exportToChildren: true,
  patchNodeHttp: true,
  logTunnels: false,
}

/** Read a schemastery `.volatile()` reference (an object with `.get()`) or a plain value. */
export function unref(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.get === 'function' ? value.get() : value
}

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean)
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.startsWith('[')) {
      try {
        return list(JSON.parse(text))
      } catch {}
    }
    return text.split(/[,\s，；;]+/).map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * @param {any} input - the plugin entry's `config` (may hold volatile references).
 * @param {NodeJS.ProcessEnv} env
 */
export function normalizeConfig(input = {}, env = process.env) {
  input ??= {}
  const raw = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, unref(v)]))
  if (typeof raw.bypassPrivate === 'string') raw.bypassPrivate = raw.bypassPrivate !== 'false'
  // YAML 1.1 readers turn a bare `off` into false.
  const mode = raw.mode === false ? 'off' : MODES.includes(raw.mode) ? raw.mode : DEFAULTS.mode
  // `socks` is the upstream proxy, whatever its kind; the name is kept for config compatibility.
  const socks = { ...DEFAULTS.socks, ...(raw.socks ?? {}) }
  if (!PROXY_TYPES.includes(socks.type)) socks.type = 'socks5'

  if (raw.inputMode === 'fields') {
    // "分项填写": type / host / port / username / password typed into separate boxes.
    if (PROXY_TYPES.includes(raw.proxyType)) socks.type = raw.proxyType
    if (typeof raw.host === 'string' && raw.host.trim()) socks.host = raw.host.trim().replace(/^\[|\]$/g, '')
    if (raw.port !== undefined && raw.port !== '') socks.port = Number(raw.port)
    if (typeof raw.username === 'string') socks.username = raw.username
    if (typeof raw.password === 'string') socks.password = raw.password
    if (typeof raw.remoteDns === 'boolean') socks.remoteDns = raw.remoteDns
  } else if (typeof raw.proxy === 'string' && raw.proxy.trim()) {
    // "粘贴地址/命令": a socks5(h):// URL, an ALL_PROXY export, a curl command, host:port ...
    const parsed = parseProxyInput(raw.proxy)
    if (!parsed) throw new Error(`cannot read a proxy address from proxy: ${JSON.stringify(raw.proxy.replace(/:[^:@/]*@/, ':***@'))}`)
    Object.assign(socks, { type: parsed.type, host: parsed.host, port: parsed.port, remoteDns: parsed.remoteDns })
    if (parsed.username) socks.username = parsed.username
    if (parsed.password) socks.password = parsed.password
  }
  if (socks.passwordEnv && env[socks.passwordEnv] !== undefined) socks.password = env[socks.passwordEnv]
  socks.port = Number(socks.port)
  if (!socks.host || !Number.isInteger(socks.port) || socks.port < 1 || socks.port > 65535) {
    throw new Error(`invalid proxy server ${socks.host}:${socks.port}`)
  }
  socks.timeoutMs = Number(socks.timeoutMs) > 0 ? Number(socks.timeoutMs) : DEFAULTS.socks.timeoutMs

  const bool = (key) => (typeof raw[key] === 'boolean' ? raw[key] : DEFAULTS[key])
  return {
    mode,
    socks,
    llmHosts: list(raw.llmHosts),
    providers: list(raw.providers),
    builtinHosts: bool('builtinHosts'),
    bypass: list(raw.bypass),
    bypassPrivate: bool('bypassPrivate'),
    exportToChildren: bool('exportToChildren'),
    patchNodeHttp: bool('patchNodeHttp'),
    logTunnels: bool('logTunnels'),
  }
}
