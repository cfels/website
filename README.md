# moxiu☆ちゃんねる

my personal website

## Run

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

first setup `FILES_UPLOAD_TOKEN=<your token>` and done optionally u can setup `FILES_MAX_UPLOAD_MB=100`

### Environment settings

Set these in the service environment or a local `.env` file. Keep `.env` private and out of Git.

| Setting | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Address both website and download listeners bind to. Use `127.0.0.1` when Caddy runs on the same host without a container network. |
| `PORT` | `3000` | Website listener port. Your home Caddy setup expects port `3001`; Docker can also map host port 3001 to the app's port 3000. |
| `FILES_UPLOAD_TOKEN` | Empty; owner actions disabled | Secret bearer token for uploads and folder creation. Set at least 32 characters; shorter tokens are rejected at startup. Owner actions require HTTPS when accessed through the proxies. |
| `FILES_MAX_UPLOAD_MB` | `10240` | Maximum bytes per file, expressed in MiB (1024 × 1024 bytes). Must produce a positive safe integer number of bytes. Match the Caddy request-body limits if changing it. |
| `FILES_DOWNLOAD_PORT` | Unset; no separate listener | Optional attachment-only listener port, e.g. `3003` for uncapped downloads. Valid range is 0–65535; 0 selects a temporary port for testing. |

`bun run dev` uses `--dev` to serve `static/`; production serves `build/`. There is no environment setting for the files directory or text-preview limit: uploads live in `files/` next to `server.js`, and previews are capped at 10 MiB.

Select one or more files in **Webmaster tools → Files** and choose **Upload files**. Files upload one at a time into the current folder, with progress and **Cancel uploads** to stop the queue. Existing files are never replaced; duplicate names are reported and the other selected files continue uploading. Completed uploads remain available if you cancel or lose the connection. The token is cleared after the queue finishes.

Upload a `.txt`, `.md`, or extensionless `README` file to explain the downloads. Select **View** beside it in the file list to read it on the website; **Download** saves the file. The viewer displays plain UTF-8 text up to 10 MiB, including JSON, logs, CSV/TSV, YAML, TOML, INI, CFG, CONF, and FGCONFIG files in subfolders.

Folder sizes sum downloadable file bytes in all their subfolders. Hidden files, symlinks, hard links, and other mounts are excluded, just as they are from downloads. Counting stops after 10,000 entries per page or 64 folder levels; larger trees show a dash instead of an incomplete total.

The upload-token field supports password-manager autofill. In Proton Pass, use a Login item for the website URL with the upload token in its password field. The website still clears the token after an action and does not store it.

### Uncapped downloads with traffic control

Set `FILES_DOWNLOAD_PORT=3003` in the existing website service's environment and restart it. The same Bun process then serves attachments on a second listener using the same file-access protections. This listener does not serve website pages, folder listings, text previews, or upload APIs. If the app runs in Docker, publish port 3003 to the home Caddy container in the same way as port 3001.

For the home setup whose `tc` filter matches TCP source port 3001 and destination 172.18.0.4 on `br-c9dab730152d`, keep that filter and its 312 Kbit/s, 120 ± 30 ms netem rule. Responses from port 3003 do not match it. This only bypasses the shown rule; other network caps still apply.

In the home `http://moxiu.vacpro.fyi` block, replace the existing `reverse_proxy` with the following. Keep the imports, HTTPS owner-action guard, and upload body limit above it. The VPS configuration stays the same.

```caddyfile
@downloads {
    method GET HEAD
    path /files/*
    not path /files/ /files/*/
    not query view=1
}

handle @downloads {
    reverse_proxy 172.17.0.1:3003 {
        trusted_proxies 10.0.0.1/32
    }
}

handle {
    reverse_proxy 172.17.0.1:3001 {
        trusted_proxies 10.0.0.1/32
    }
}
```

Use an internal connection from Caddy for port 3003; clients keep using the normal website URL. Folder links and `?view=1` previews remain on port 3001. Opening a folder URL without its trailing slash only redirects to the capped folder listing.

### Windows XP / Internet Explorer 8

The website serves its Comic Sans MS, Verdana, and Tahoma fonts locally: WOFF2 for modern browsers and [EOT](https://www.w3.org/submissions/EOT/) for IE8. IE8 also loads a separate stylesheet with table layouts, solid-color backgrounds, and PNG versions of the WebP artwork. The frame buttons work without modern JavaScript APIs. All content documents explicitly request standards mode and UTF-8.

Browse using `http://moxiu.vacpro.fyi/` on XP through the existing VPS legacy-HTTP route. File search, downloads, and plain-text previews work without the modern upload script. Webmaster tools remain unavailable in IE8; use a modern browser over HTTPS for owner actions. Keep both Caddy HTTPS owner-action guards enabled. External HTTPS links depend on the destination's support for XP's browser.

The IE8 changes have automated compatibility checks and can be previewed with the fallback stylesheet in a modern browser. Actual Windows XP / IE8 rendering still needs verification on that browser.
