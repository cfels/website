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

## File host

`/files/` publicly lists and downloads files from the project's `files/` directory, including subfolders. The page displays that directory as `C:\files\`. Add files by copying them into `files/` on the server, or use the owner upload form described below. Rebuilding the site does not touch them. Hosted files are excluded from Git. Search filters file and folder names in the current folder without requiring JavaScript; it is case-insensitive. Open a subfolder to search its contents, or select **Show all** to clear the search.

Owner actions are disabled until `FILES_UPLOAD_TOKEN` is set on the server. Generate a random token with `openssl rand -hex 32`, put it in the ignored `.env` file as `FILES_UPLOAD_TOKEN=<your token>`, and restart the server. Open **Files → Webmaster tools**, enter the token, and upload a file or create a folder. Both actions use the folder you're currently browsing. The browser clears the token after each action and does not save it. Use HTTPS on the public site to protect the token in transit.

Uploads never replace existing entries. The default limit is 10 GiB (10,737,418,240 bytes) per file; set `FILES_MAX_UPLOAD_MB` to change it in MiB (`10240` keeps the default). Remove an older `FILES_MAX_UPLOAD_MB=100` override if you set one previously. Uploads stream to disk, show progress, and can be cancelled. Incomplete uploads are hidden and removed when a transfer fails. Folder creation requires an existing parent; open a folder to create another inside it.

The file host requires Linux with `/proc` mounted. It pins the storage directory with a file descriptor, rejects traversal and hidden names, opens every path component without following symlinks, and excludes hard-linked files, special files, and nested mounts (including bind mounts). Downloads are forced attachments with scripts disabled. These restrictions apply to the file endpoints; the Bun process still reads the site's code and static assets. Run it under a dedicated account or container if you also need operating-system isolation of the whole server.

Deploy this feature with `bun run start`; a static-only host cannot run the file browser or uploads. Preserve `files/` as persistent storage across deployments.

## Caddy and old browsers

`Caddyfile.example` keeps Caddy's certificate management, serves XP/Server 2003 user agents over HTTP, and temporarily redirects other HTTP visitors to HTTPS. Replace `vacpro.fyi` if your domain differs and merge the example into your existing Caddyfile. Run the Bun backend with `HOST=127.0.0.1` and keep port 3000 private. Only ports 80 and 443 should be public. Validate the merged configuration with `caddy validate --config /path/to/Caddyfile --adapter caddyfile` before reloading Caddy.

Old browsers must visit `http://vacpro.fyi` explicitly. A failed TLS handshake occurs before an HTTP request, so Caddy cannot send an HTTP redirect after it fails. The user-agent check recognizes `Windows NT 5.1` and `5.2`; it is a compatibility heuristic, not a TLS capability test. For other legacy systems, extend the matcher or use a separate HTTP-only hostname.

The HTTP listener blocks all `/api/files/*` owner actions. Caddy's `X-Forwarded-Proto: http` also hides the owner tools there; public pages and downloads remain available. Legacy browsers that support HSTS can still be forced onto HTTPS by a cached or preloaded policy, including inherited `includeSubDomains`. If your main hostname requires HSTS, use a separate HTTP-only legacy hostname outside that policy. Retain modern TLS settings on the HTTPS listener.

The example allows 10 GiB upload bodies. Keep any existing proxy/CDN body limits at least as large, and avoid buffering entire uploads in Caddy. Downloads and folder listings work without modern JavaScript; webmaster actions require a modern browser. This does not add CSS compatibility with Internet Explorer on XP.

