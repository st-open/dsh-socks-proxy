# dsh-socks-proxy

[简体中文](README.zh.md) | English

An outbound proxy plugin for **DeepSeek Harness (DSH)**: route DSH traffic through **SOCKS5**, **HTTP**, or **HTTPS** proxies. Two modes — proxy only LLM API requests, or all DSH traffic.

![界面示意（非真实截图）](docs/preview.svg)

## Modes

| mode | Traffic through the proxy | Other traffic |
|---|---|---|
| `llm` | LLM API requests only (provider `baseURL` hosts from your model settings + common official endpoints + `llmHosts`) | Keeps its original route (direct, or an HTTP proxy from the environment) |
| `all` | Every outbound request of DSH: LLM, MCP HTTP, web_search, **web_fetch**, `node:http` clients, and child processes started afterwards | — |
| `off` | Nothing | — |

Loopback (localhost / 127.x / ::1), the `bypass` list, and — with `bypassPrivate: true` — private LAN IP literals always stay direct.

## Install

```bash
dsh plugin --profile desktop add github:st-open/dsh-socks-proxy
```

Or install from a local checkout:

```bash
dsh plugin --profile desktop add link:/absolute/path/to/dsh-socks-proxy
```

Restart DSH once after the first install so the Host part and the settings page load.

## Configure

Recommended: **Plugins → Installed plugins → Proxy (SOCKS5 / HTTP)**. Choose the mode, fill in the proxy, then **Save** — it takes effect immediately (all fields are hot-updatable, no restart needed).

Or configure `~/.dsh/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: socks-proxy
  name: "@st-open/dsh-socks-proxy"
  config:
    mode: llm                     # "off" | llm | all
    proxy: socks5h://127.0.0.1:7890   # socks5h:// resolves DNS at the proxy
    bypassPrivate: true
    bypass: []                    # hosts that always stay direct
    llmHosts: []                  # extra hosts treated as LLM in llm mode
    providers: []                 # restrict llm mode to these provider routes
    builtinHosts: true
    exportToChildren: true
    patchNodeHttp: true
    logTunnels: false
```

A structured form is also accepted:

```yaml
    socks:
      host: 127.0.0.1
      port: 1080
      username: me
      passwordEnv: SOCKS_PASSWORD   # read the password from an env var, avoid plaintext YAML
      remoteDns: true
      timeoutMs: 15000
```

`SOCKS5h` resolves DNS at the proxy (recommended against DNS pollution); `socks5://` resolves locally.

## Test the connection

The plugin page's **Test connection** only probes the proxy server itself (and each model endpoint's reachability) without touching live routing. Results show latency, authentication, and per-endpoint status.

## Second proxy (per-target routing)

Common case: **the LLM API goes through the main proxy, but GitHub and other sites need a different route.** When enabled, in `all` mode hosts matching `secondHosts` use `secondProxy` (a different proxy server) while every other host keeps the primary `proxy`. The local bridge picks the upstream per destination, so one bridge serves both proxies — child processes and web_fetch included.

- Only available in `all` mode (in `llm` mode non-LLM hosts stay direct by design).
- `secondHosts` is comma separated and matches subdomains: `github.com` also matches `api.github.com`; `*.githubusercontent.com` is the same.
- Disabled or with an empty `secondProxy` / `secondHosts`, the primary proxy is unaffected.

Set it under **Advanced → Enable a second proxy** on the plugin page, or in `cordis.patch.yml`:

```yaml
    secondEnabled: true
    secondProxy: socks5h://127.0.0.1:7891     # GitHub etc. use this
    secondHosts: [github.com, '*.githubusercontent.com']
```

> Child processes (git/curl …) only get `HTTP(S)_PROXY` pointing at the local bridge; the bridge then picks the upstream per host, so one `HTTP_PROXY` still sends GitHub and other sites through their respective proxies.

## How it works

1. Starts a local HTTP bridge on `127.0.0.1:<random port>` forwarding to the upstream proxy (built-in SOCKS5 and HTTP CONNECT clients, username/password auth, no third-party dependencies).
2. Replaces undici's global dispatcher with a routing dispatcher: matching requests go through the bridge, others keep the original dispatcher.
3. In `all` mode, registers the bridge with `@deepseek-ai/dsh-http-proxy` so web_fetch, child processes, and `proxyRouteFor()` agree.
4. Restores the original dispatcher, environment, and agents on disable/uninstall.

## Known limitations

- SOCKS5 only (no SOCKS4 / PAC / system-proxy auto-detection).
- `llm` mode matches by hostname; a host shared with other services gets all its traffic proxied.
- Worker threads (workflow / PTC runtime) have their own global dispatcher and are not affected.
- Child processes are proxied only in `all` mode with `exportToChildren: true`, and only those started after the plugin loads.
- Keep-alive connections established before the plugin loads keep their old route until closed.

## License

MIT
