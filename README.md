# moxiu☆ちゃんねる

Haiii~

my little corner on the internet. Linux, low-level stuff & Lucky☆Star! :p

## running it

use Bun 1.4.3 or newer. older versions won't start because they're missing security fixes.

```sh
bun run dev
```

open [localhost:3000](http://localhost:3000). make sure something else isn't already using that port.

settings go in `.env`, next to `package.json`. `.env.example` has the defaults.

## deploying

```sh
bun run check
bun run build
bun run test
bun run start
```

`dev` is for working on the site, `start` is for the server. setting `NODE_ENV` alone doesn't turn on development mode.

## my file stash

put downloads in `files/`. stuff in there is public, so keep passwords, tokens and password exports out of it. same goes for `static/` and `build/`.

set `FILES_UPLOAD_TOKEN` to a random secret with at least 32 characters to enable webmaster tools. uploads and making folders need HTTPS in production. the tools start closed.

uploads are **10 GiB per file** by default. `FILES_MAX_UPLOAD_MB=10240` is optional unless you want to change that. text files, Markdown and other supported text formats have a preview, up to 10 MiB.

search looks through all folders and subfolders and shows the full path. it checks up to 10,000 entries, goes 64 folders deep and shows up to 1,000 matches. normal folder listings have the same entry and result limits. if there's more, the page tells you; you can still browse the folders.

downloads & random stuff. help yourself :p

## environment flags

| flag | default | what it does |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | address the website and download listener bind to. with Docker Caddy, use the private host address it can reach. keep those ports private. |
| `PORT` | `3000` | website port. |
| `TRUSTED_PROXY_IPS` | `127.0.0.1,::1` | individual IPs of proxies connecting straight to Bun, separated by commas. only these can tell the app a request used HTTPS. empty means trust none. |
| `FILES_UPLOAD_TOKEN` | empty | random secret for webmaster tools, at least 32 characters. empty disables owner actions. |
| `FILES_MAX_UPLOAD_MB` | `10240` | upload limit per file, in MiB. default is 10 GiB. the value must give a positive, safe integer number of bytes. |
| `FILES_DOWNLOAD_PORT` | unset | optional separate port for downloads only. use 1–65535, or 0 for a random test port. keep this behind Caddy too. |
| `FILES_STORAGE_LIMIT_MB` | `102400` | total file stash limit in MiB. default is 100 GiB; uploads reserve room before writing. |
| `FILES_MIN_FREE_SPACE_MB` | `1024` | free disk space to leave available, in MiB. default is 1 GiB, checked before uploads and folder creation. |
| `FILES_MAX_CONCURRENT_PAGES` | `4` | file listings and previews served at once, until the response finishes or is cancelled. |
| `FILES_MAX_CONCURRENT_DOWNLOADS` | `16` | downloads at once. there's no speed cap per download. |
| `FILES_MAX_CONCURRENT_UPLOADS` | `2` | uploads and folder creation at once. |

## Caddy stuff

for my home setup in `Caddyfile.example`:

```env
HOST=172.17.0.1
PORT=3001
TRUSTED_PROXY_IPS=172.18.0.4
FILES_DOWNLOAD_PORT=3003
```

`172.18.0.4` is the home Caddy container's current source IP. it can change if the container is recreated, so check it with:

```sh
docker exec caddy-caddy-1 ip route get 172.17.0.1
```

use the IP after `src` for `TRUSTED_PROXY_IPS`, then restart the website. for another setup, use the actual proxy IP connecting to Bun. don't add the whole Docker subnet.

home Caddy still needs `trusted_proxies 10.0.0.1/32` for the VPS. that's a separate setting: Caddy trusts the VPS, Bun trusts home Caddy. with the wrong Bun setting, owner actions return 403.

`FILES_DOWNLOAD_PORT` is optional. it's there so Caddy can send downloads to a different port when the website port is slowed down for retro loading.

## security

[the security review](SECURITY_REVIEW.md) has the checks and deployment details.

HTTP stays available for XP/IE8 browsing. no webmaster tools there in production; uploads and folder creation need HTTPS verified through the trusted proxy. HTTPS responses get HSTS. keep Caddy's HTTP owner-action block too.

development mode allows HTTP owner actions only over a direct loopback connection with no forwarded-protocol header.

run one app writer per stash. storage checks also stop at 10,000 entries and 64 folder levels; if the app can't safely count the stash, writes return 503. full storage returns 507, and busy limits return 429 with `Retry-After`.

## toolbar font

fonts are served by the website. IE8 gets EOT files, including a tiny font for the refresh arrow. to regenerate that one, install Python and FontTools, then run:

```sh
python scripts/prepare-toolbar-font.py /path/to/DejaVuSans.ttf
```

its license is in `static/assets/fonts/toolbar-LICENSE.txt`.

#### btw works on Windows XP / IE 8
