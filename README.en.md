# Proxy (SOCKS5 / HTTP)

[简体中文](README.md) | English

Route DeepSeek Harness (DSH) internet traffic through a proxy. Supports **SOCKS5, HTTP, HTTPS**.

## What it does

Maybe your computer can reach the LLM but not GitHub/Google — or the other way round. This plugin decides **which requests use a proxy and which stay direct**.

## Three proxies, one form

Three cards sit side by side; the one you click is what the form below edits:

| Card | Covers | When empty |
|---|---|---|
| **DSH proxy** | DSH itself: web search, web fetch, MCP, terminal commands | follows the **global proxy** |
| **LLM proxy** | LLM API (provider addresses from your model settings are detected automatically) | follows the **global proxy** |
| **Global proxy** | the default for the two above when they have none of their own | traffic without its own proxy goes direct |

- **Filled in = on, empty = off.** There are no separate switches.
- Every card shows whether it is filled in, what it holds, and what it **actually** does (this proxy / follows global / direct). After **Test connection** it also marks each proxy as working or not.
- Typical use: fill in only the **global proxy** and one proxy covers everything; add an **LLM proxy** if the LLM needs a different one.
- Paste what your provider gave you (a URL, `export HTTPS_PROXY=…`, `curl -x …`) into **Paste to detect** and it is split into the fields.
- The **Exceptions** section below (LAN direct, always-direct hosts, extra LLM hosts) applies to all three.

Upgrading from an older version: the first time you open the page, your old mode + proxy is converted to the new cards automatically (for example "all traffic via one proxy" becomes the global proxy). Check it and press Save.

## Install

```bash
dsh plugin --profile desktop add github:st-open/dsh-socks-proxy
```

Restart DSH once after the first install.

## Use (3 steps)

1. Open **Plugins → Proxy (SOCKS5 / HTTP)**.
2. Click the **Global proxy** card and paste your proxy address into **Paste to detect**, e.g.:
   - `socks5h://127.0.0.1:7890`
   - `http://127.0.0.1:7897`
   - (you can also paste `export HTTPS_PROXY=…` or `curl -x …` — it is detected automatically)
3. Press **Save**. It applies immediately.

Not sure it works? Click **Test connection** first.

> **Sidebar indicator**: a small dot at the sidebar foot (beside Settings) — **green = proxy on**, **grey = off**; hover shows the current mode, so you never forget whether the proxy is active.

## Want "DSH via A, LLM via B"?

Fill A into the **DSH proxy** card and B into the **LLM proxy** card; leave the global proxy empty.

Example: DSH via local Clash `http://127.0.0.1:7897`, LLM via `socks5h://user:pass@10.0.0.1:1080`.

## FAQ

- **`socks5h://` vs `socks5://`?** `h` lets the proxy resolve DNS — usually more reliable, **recommended**.
- **LAN addresses fail?** Turn off "Connect LAN addresses directly" under Exceptions.
- **Need a restart?** Saving applies immediately; only the **first install** needs one DSH restart.
- **Wrong settings?** Click **Test connection** — it tells you which step failed (unreachable, bad login, wrong type, …).

## Contributors

- south
- 大肥鱼
