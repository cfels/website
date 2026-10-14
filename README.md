# moxiu☆ちゃんねる

my personal website

## Run

Requires Bun 1.4.3 or newer. Startup refuses older versions because the 1.4.3 release includes HTTP request-handling and TLS security fixes.

```sh
bun run dev
```

the website will open at `http://localhost:3000`. also make sure 3000 port is not locked by other app

## deploying

```sh
bun run check
bun run build
bun run test
```


## files host

first setup `FILES_UPLOAD_TOKEN=<your token>` and done optionally u can setup `FILES_MAX_UPLOAD_MB=100`,`FILES_DOWNLOAD_PORT`

file search matches names across all folders and subfolders and shows each result's full path. Searches check up to 10,000 entries, descend up to 64 folder levels, and return up to 1,000 matches. If a limit is reached, the page says that results may be incomplete; folders can still be browsed directly.

## environment flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Address for both listeners. For a Docker proxy, bind to the private host interface it can reach; keep the backend ports private. |
| `PORT` | `3000` | Website listener port. |
| `TRUSTED_PROXY_IPS` | `127.0.0.1,::1` | Comma-separated individual IPs of proxies connecting directly to Bun. Only these peers can assert HTTPS. An empty value trusts no proxies. |
| `FILES_UPLOAD_TOKEN` | empty | Enables owner actions; requires at least 32 characters. Use a randomly generated secret. |
| `FILES_MAX_UPLOAD_MB` | `10240` | Maximum upload size in MiB (10 GiB by default). Must produce a positive, safe integer number of bytes. |
| `FILES_DOWNLOAD_PORT` | unset | Optional attachment-only listener for downloads. Accepts ports 1–65535, or 0 for an automatically assigned test port. Keep it behind the proxy too. |
| `FILES_STORAGE_LIMIT_MB` | `102400` | Total public-file storage quota in MiB (100 GiB). Pending uploads reserve capacity before writing. |
| `FILES_MIN_FREE_SPACE_MB` | `1024` | Filesystem free-space reserve in MiB, checked before owner writes. |
| `FILES_MAX_CONCURRENT_PAGES` | `4` | Concurrent file listings/previews, counted until their response body finishes or is cancelled. |
| `FILES_MAX_CONCURRENT_DOWNLOADS` | `16` | Simultaneous downloads. Individual transfer speed stays uncapped. |
| `FILES_MAX_CONCURRENT_UPLOADS` | `2` | Concurrent owner actions, including uploads and folder creation. |

`bun run dev` enables development mode explicitly. Use `bun run start` for production; `NODE_ENV` does not select the app's development mode.

## security

See [the security review](SECURITY_REVIEW.md) for verified protections and remaining deployment checks. Public files belong in `files/`; everything downloadable there is public. Keep credentials and password exports outside that folder, `static/`, and `build/`.

Production owner actions require verified HTTPS from a trusted proxy; HTTP pages omit owner tools. The application adds HSTS to verified HTTPS responses. Keep the public-edge HTTP owner-action block as an additional protection. Development HTTP owner access is allowed only for direct loopback requests without a forwarded-protocol header.

For the home Caddy configuration in `Caddyfile.example`, set `HOST=172.17.0.1`, `PORT=3001`, and optionally `FILES_DOWNLOAD_PORT=3003`. Set `TRUSTED_PROXY_IPS` to the actual home Caddy container IP that connects to Bun, not the VPS IP and not the entire Docker subnet. Keep the existing home proxy's `trusted_proxies 10.0.0.1/32` setting so its upstream requests retain the verified HTTPS protocol. Until the Bun peer allowlist is configured correctly, owner actions fail closed with 403.

Normal listings are bounded to 10,000 examined entries and 1,000 rendered results too. Quota accounting fails closed if the tree is too deep or large to measure safely. Full capacity returns 507; busy limits return 429 with `Retry-After`.

## toolbar font

IE8 uses a self-hosted EOT subset for the refresh arrow. To regenerate it with Python and FontTools installed:

```sh
python scripts/prepare-toolbar-font.py /path/to/DejaVuSans.ttf
```

The font license is included in `static/assets/fonts/toolbar-LICENSE.txt`.

#### btw works on Windows XP / IE 8
