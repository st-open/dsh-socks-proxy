# Proxy (SOCKS5 / HTTP)

[简体中文](README.md) | English

![Preview (illustration, not a screenshot)](docs/preview.svg)

Route DeepSeek Harness (DSH) internet traffic through a proxy. Supports **SOCKS5, HTTP, HTTPS**.

## What it does

Maybe your computer can reach the LLM but not GitHub/Google — or the other way round. This plugin decides **which requests use a proxy and which stay direct**.

## Three modes (pick one)

| Mode | Through the proxy | Direct |
|---|---|---|
| **LLM only** | LLM API requests | everything else |
| **DSH only** | DSH's own traffic: web pages, search, terminal commands | LLM |
| **All traffic** | everything (LLM + DSH) | nothing |

> In short: **All traffic = LLM only + DSH only**.

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

## Want "DSH via A, LLM via B"?

1. Mode: **All traffic**.
2. **Proxy server**: A.
3. Open **Advanced → Separate proxy for LLM**, fill in B.

Example: DSH via local Clash `http://127.0.0.1:7897`, LLM via `socks5h://user:pass@10.0.0.1:1080`.

## FAQ

- **`socks5h://` vs `socks5://`?** `h` lets the proxy resolve DNS — usually more reliable, **recommended**.
- **LAN addresses fail?** Turn off "Connect LAN addresses directly" in Advanced.
- **Need a restart?** Saving applies immediately; only the **first install** needs one DSH restart.
- **Wrong settings?** Click **Test connection** — it tells you which step failed (unreachable, bad login, wrong type, …).

## Contributors

- 大肥鱼
