/**
 * Install the SOCKS5 routing for one mode. Independent of Cordis so it can be tested directly.
 *
 *  - mode "llm": only requests whose host is an LLM API endpoint go through SOCKS5; everything
 *    else keeps whatever route DSH already had (direct, or the HTTP(S)_PROXY from the environment).
 *  - mode "all": every outbound request of the DSH host goes through SOCKS5 — fetch / LLM / MCP
 *    HTTP / web_search, web_fetch (via DSH's own proxy policy), `node:http` clients, and child
 *    processes started afterwards (they receive HTTP(S)_PROXY pointing at the local bridge).
 *
 * Loopback, the `bypass` list and (by default) private LAN IP literals always stay direct.
 */
import http from 'node:http'
import https from 'node:https'
import { startBridge } from './bridge.js'
import { importHostPackage } from './host-modules.js'
import { isLoopback, isPrivateLiteral, matchesHostList, normalizeHost } from './match.js'
import { createRouteDecision } from './route.js'

const PRIVATE_CIDRS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16']

function pick(mod, name) {
  return mod?.[name] ?? mod?.default?.[name]
}

/**
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @param {object} deps
 * @param {() => string[]} deps.llmHosts - current LLM host list.
 * @param {{ info: Function, warn: Function, debug?: Function }} deps.logger
 * @returns {Promise<{ dispose: () => Promise<void>, shouldProxy: (url: URL) => boolean, bridgeUrl: string, viaDshPolicy: boolean }>}
 */
export async function installSocksRouting(config, { llmHosts, logger }) {
  const undici = await importHostPackage('undici')
  const Dispatcher = pick(undici, 'Dispatcher')
  const ProxyAgent = pick(undici, 'ProxyAgent')
  const getGlobalDispatcher = pick(undici, 'getGlobalDispatcher')
  const setGlobalDispatcher = pick(undici, 'setGlobalDispatcher')
  if (!Dispatcher || !ProxyAgent || !getGlobalDispatcher || !setGlobalDispatcher) {
    throw new Error('the undici copy found in the DSH installation lacks Dispatcher/ProxyAgent')
  }

  const disposers = []
  const runDisposers = async () => {
    while (disposers.length) {
      try {
        await disposers.pop()()
      } catch (error) {
        logger.warn(`socks-proxy: cleanup step failed: ${error?.message ?? error}`)
      }
    }
  }

  try {
    let lastError = ''
    let lastErrorAt = 0
    const bridge = await startBridge({
      socks: config.socks,
      onError(message) {
        const now = Date.now()
        if (message === lastError && now - lastErrorAt < 10000) return
        lastError = message
        lastErrorAt = now
        logger.warn(`socks-proxy: ${message}`)
      },
      onTunnel(host, port) {
        if (config.logTunnels) logger.info(`socks-proxy: tunnel ${host}:${port}`)
      },
    })
    disposers.push(() => bridge.close())

    const shouldProxy = createRouteDecision(config, llmHosts)

    const direct = getGlobalDispatcher()
    let proxied
    let viaDshPolicy = false

    if (config.mode === 'all') {
      // Prefer DSH's own policy module: web_fetch, child spawns and proxyRouteFor() then all agree.
      const noProxy = [...config.bypass, ...(config.bypassPrivate ? PRIVATE_CIDRS : [])].join(',')
      try {
        const policyModule = await importHostPackage('@deepseek-ai/dsh-http-proxy')
        const install = pick(policyModule, 'installProxyFromEnvironment')
        if (typeof install !== 'function') throw new Error('installProxyFromEnvironment not exported')
        const env = new Map(
          Object.entries({ http_proxy: bridge.url, https_proxy: bridge.url, no_proxy: noProxy })
            .filter(([, v]) => v)
            .map(([k, v]) => [k, { value: v }]),
        )
        const restore = await install(env, (message) => logger.warn(`socks-proxy: ${message}`))
        disposers.push(() => restore())
        proxied = getGlobalDispatcher()
        viaDshPolicy = true
        if (!config.exportToChildren) {
          // dsh-http-proxy published the bridge into process.env for children; withdraw it.
          const names = ['http_proxy', 'HTTP_PROXY', 'https_proxy', 'HTTPS_PROXY']
          const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]))
          for (const n of names) if (process.env[n] === bridge.url) delete process.env[n]
          disposers.push(() => {
            for (const [n, v] of Object.entries(saved)) if (v !== undefined) process.env[n] = v
          })
        }
      } catch (error) {
        logger.warn(`socks-proxy: DSH proxy policy unavailable (${error?.message ?? error}); using the plugin's own dispatcher — web_fetch keeps its direct route`)
        proxied = new ProxyAgent({ uri: bridge.url })
        disposers.push(() => proxied.close())
        if (config.exportToChildren) {
          const values = { http_proxy: bridge.url, HTTP_PROXY: bridge.url, https_proxy: bridge.url, HTTPS_PROXY: bridge.url }
          if (noProxy) Object.assign(values, { no_proxy: `localhost,127.0.0.1,::1,${noProxy}`, NO_PROXY: `localhost,127.0.0.1,::1,${noProxy}` })
          const saved = Object.fromEntries(Object.keys(values).map((n) => [n, process.env[n]]))
          Object.assign(process.env, values)
          disposers.push(() => {
            for (const [n, v] of Object.entries(saved)) {
              if (v === undefined) delete process.env[n]
              else process.env[n] = v
            }
          })
        }
      }

      if (config.patchNodeHttp) {
        // node:http / node:https clients (e.g. the OTLP telemetry exporter) bypass undici.
        try {
          const proxyEnv = {
            HTTP_PROXY: bridge.url,
            HTTPS_PROXY: bridge.url,
            NO_PROXY: ['localhost', '127.0.0.1', '::1', ...config.bypass, ...(config.bypassPrivate ? PRIVATE_CIDRS : [])].join(','),
          }
          const httpAgent = new http.Agent({ keepAlive: true, proxyEnv })
          const httpsAgent = new https.Agent({ keepAlive: true, proxyEnv })
          const previous = [http.globalAgent, https.globalAgent]
          http.globalAgent = httpAgent
          https.globalAgent = httpsAgent
          disposers.push(() => {
            http.globalAgent = previous[0]
            https.globalAgent = previous[1]
            httpAgent.destroy()
            httpsAgent.destroy()
          })
        } catch (error) {
          logger.warn(`socks-proxy: node:http agents not patched: ${error?.message ?? error}`)
        }
      }
    } else {
      proxied = new ProxyAgent({ uri: bridge.url })
      disposers.push(() => proxied.close())
    }

    class SocksRouter extends Dispatcher {
      dispatch(options, handler) {
        let url
        try {
          url = new URL(String(options.origin))
        } catch {
          return direct.dispatch(options, handler)
        }
        return (shouldProxy(url) ? proxied : direct).dispatch(options, handler)
      }
      close(callback) {
        const done = Promise.resolve()
        if (typeof callback === 'function') done.then(() => callback(null))
        return done
      }
      destroy(error, callback) {
        const cb = typeof error === 'function' ? error : callback
        const done = Promise.resolve()
        if (typeof cb === 'function') done.then(() => cb(null))
        return done
      }
    }
    const router = new SocksRouter()
    const beforeRouter = getGlobalDispatcher()
    setGlobalDispatcher(router)
    disposers.push(() => {
      if (getGlobalDispatcher() === router) setGlobalDispatcher(beforeRouter)
    })

    return { dispose: runDisposers, shouldProxy, bridgeUrl: bridge.url, bridgePort: bridge.port, viaDshPolicy }
  } catch (error) {
    await runDisposers()
    throw error
  }
}
