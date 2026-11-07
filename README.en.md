# Proxy (SOCKS5 / HTTP)

[简体中文](README.md) | English

![Preview (illustration, not a screenshot)](docs/preview.svg)

Route DeepSeek Harness (DSH) internet traffic through a proxy. Supports **SOCKS5, HTTP, HTTPS**.

## What it does

Maybe your computer can reach the LLM but not GitHub/Google — or the other way round. This plugin decides **which requests use a proxy and which stay direct**.

## Two switches (turn on what you need)

| Switch | When on |
|---|---|
| **DSH's own traffic uses a proxy** | DSH itself (web search, web fetch, MCP, terminal commands) goes through the primary proxy |
| **LLM traffic uses a proxy** | LLM API goes through a proxy; if an **LLM proxy server** is set under it, it uses that, otherwise the primary proxy |

Both off = no proxy; one on = only that kind is proxied; both on = each uses its own (possibly different) proxy.

## Install

```bash
dsh plugin --profile desktop add github:st-open/dsh-socks-proxy
```

Restart DSH once after the first install.

## Use (3 steps)

1. Open **Plugins → Proxy (SOCKS5 / HTTP)**.
2. Paste your proxy address into **Proxy server**, e.g.:
   - `socks5h://127.0.0.1:7890`
   - `http://127.0.0.1:7897`
   - (you can also paste `export HTTPS_PROXY=…` or `curl -x …` — it is detected automatically)
3. Choose a mode → **Save**. It applies immediately.

Not sure it works? Click **Test connection** first.

> **Sidebar indicator**: a small dot at the sidebar foot (beside Settings) — **green = proxy on**, **grey = off**; hover shows the current mode, so you never forget whether the proxy is active.

## Want "DSH via A, LLM via B"?

1. Turn on **both** switches (DSH's own traffic, and LLM traffic).
2. **Proxy server**: A (for DSH).
3. Fill B in **LLM proxy server (optional)** that appears under the LLM switch.

Example: DSH via local Clash `http://127.0.0.1:7897`, LLM via `socks5h://user:pass@10.0.0.1:1080`.

## FAQ

- **`socks5h://` vs `socks5://`?** `h` lets the proxy resolve DNS — usually more reliable, **recommended**.
- **LAN addresses fail?** Turn off "Connect LAN addresses directly" in Advanced.
- **Need a restart?** Saving applies immediately; only the **first install** needs one DSH restart.
- **Wrong settings?** Click **Test connection** — it tells you which step failed (unreachable, bad login, wrong type, …).

## Contributors

- south
- 大肥鱼
