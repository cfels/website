# Website security review — updated 2026-10-15

The application findings from the original 2026-10-14 review are fixed in this checkout and covered by regression tests. The latest 2026-10-15 application follow-up found no new unresolved security issue in the inspected folder-download and update-date changes. These changes remain local and undeployed. Earlier live checks found HSTS on an HTTPS Files response; this does not establish that every local change is deployed. Public XP/IE8 HTTP browsing remains read-only at the owner's explicit request; its lack of transport integrity is an accepted compatibility risk. The owner confirmed that the servers are configured correctly; their configuration was not independently audited.

## Scope and evidence

Reviewed `server.js`, `file-host.js`, `request-policy.js`, all browser scripts and HTML, security headers, asset/build scripts, environment configuration, `Caddyfile.example`, and the two-proxy configuration supplied in the chat. Reviewed authentication, CSRF/CORS, escaping, downloads/previews, traversal and filesystem boundaries, upload atomicity, error disclosure, and resource limits. The 2026-10-15 follow-up also covered image previews, the filesystem-derived update date, and password-manager autofill and frame navigation. No application package dependencies are declared. The original review used a Bun 1.4.3 release archive verified against the vendor checksum from a temporary test directory; the latest checks used the available Bun 1.4.3 runtime.

The original review included the complete automated suite, static checks, build, and real XP/IE8 visual checks. Its live requests to `moxiu.vacpro.fyi` used HEAD, public-page GET, OPTIONS, and empty POST requests with missing or deliberately invalid credentials. On 2026-10-15, the final 95-test suite, static checks, and build passed; local Chromium checks covered the standalone and framed Files pages and the full-page webmaster transition. Follow-up live checks used only public Files GET and HEAD requests. No real upload token was read or sent, and no live files were created or changed. Real XP/IE8 visual checks were not repeated for this follow-up.

The deployed OS/runtime versions, firewall rules, container permissions, proxy snippets, actual token strength, logs, backup/disk quotas, repository history, and download contents were not inspected. No load test, port scan, malware scan, or authenticated live upload was performed. The public static directories must remain under trusted deployment control; their canonical-path checks are not a sandbox against a concurrent hostile local writer.

## Findings

| Finding | Impact and evidence | Status |
| --- | --- | --- |
| Conditional file disclosure in static serving | A fake `build/.env` in an isolated fixture returned 200. The previous handler also followed public-tree symlinks without checking their destination. If credentials or outside links were accidentally deployed, visitors could retrieve them. | Fixed locally: decoded hidden paths, links to hidden targets, and links outside the public tree return 403. Regression checks cover GET and HEAD, including directory links. Links to ordinary public files still work. The live `/.env` request returned 404; no actual credential leak was observed. |
| Missing HSTS | The 2026-10-14 live HTTPS responses lacked a remembered HTTPS-only policy. | Fixed locally: both Bun listeners add HSTS only when HTTPS metadata comes from a trusted connecting peer. The home Caddy example also adds it only to requests from the verified VPS HTTPS route. Integration tests verify the header. The 2026-10-15 live HTTPS Files HEAD response includes `max-age=31536000`; the remaining deployed routes and proxy configuration were not re-audited. |
| Backend exposure and proxy trust | Direct backend access previously bypassed the application's HTTPS decision when the forwarded-protocol header was absent. | Fixed locally: listeners default to loopback. Production owner actions and token fields require a strict HTTPS value from an IP in `TRUSTED_PROXY_IPS`. Untrusted, missing, ambiguous, and HTTP metadata fail closed, even with the correct token. A real connection from an untrusted peer cannot spoof HTTPS. Configure the actual home Caddy container IP before deployment; do not trust its entire subnet. |
| Unbounded application file workloads | Ordinary listings, simultaneous file responses, and total public upload storage previously lacked aggregate limits. | Fixed locally: normal listings now share the 10,000-entry/1,000-result bounds. Defaults permit 4 file pages, 16 downloads, and 2 owner actions at a time. Response slots remain occupied until completion/cancellation and release on abort. Uploads reserve from a 100 GiB public-file quota and preserve at least 1 GiB of filesystem free space at admission. Publication counters prevent a concurrent commit from being missed by quota snapshots. Uncountable trees fail closed for writes. Individual download speed stays uncapped as requested. |
| Patched runtime requirement | Bun 1.4.3 fixes aborted-request metadata handling, HTTP connection handling, and TLS checks. The system test runtime was 1.4.2. | Fixed locally: package engines and startup require Bun 1.4.3 or newer. Startup rejection was verified with 1.4.2, and all final checks passed on 1.4.3. Deploy with the patched runtime. See the [official release notes](https://bun.sh/blog/bun-v1.4.3#security). |
| Legacy HTTP compatibility | The XP HTTP page returned 200 while omitting the owner token field and tools. HTTP public content can still be read or changed in transit, and legacy-browser rendering does not provide modern-browser security. | Retained as the requested read-only compatibility route. Owner actions should use HTTPS in a current browser. |

The app and home proxy example now emit HSTS on verified HTTPS traffic. The VPS HTTPS virtual host may additionally emit the same header directly:

```caddyfile
header Strict-Transport-Security "max-age=31536000"
```

The example deliberately omits `includeSubDomains` and `preload`, which would require a broader domain-wide HTTPS commitment. HSTS is learned through HTTPS responses by supporting browsers. See the [MDN HSTS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security). Caddy configuration validation was not available locally because the Caddy executable is not installed.

## Verified application protections

- Production owner actions require verified HTTPS, POST, and a bearer token. Only direct loopback development requests without forwarded metadata may use HTTP. Missing, invalid, disabled, untrusted-peer, and forwarded-HTTP authorization cases are tested. Tokens are compared using fixed-length SHA-256 digests with `timingSafeEqual`; a randomly generated secret is still required.
- Browser uploads send credentials in the Authorization header, do not store them in application browser storage or URLs, and clear the input after an action. Form-body passwords do not authorize uploads. A missing token disables owner actions.
- Cross-site owner requests marked by Fetch Metadata are rejected. Browser requests with a custom Authorization header require a CORS preflight; the application does not grant cross-origin access. No cookie-based owner session exists. These controls do not replace bearer authentication.
- Public file operations validate every path component and use descriptor-relative opens with `O_NOFOLLOW`. Symlinks, hard-linked files, hidden paths, non-regular files, different devices, and different mounts are excluded. A renamed/replaced root cannot redirect searches, reads, or writes.
- Uploads use private, unpredictable temporary files, validate declared length, enforce actual streamed size and its reservation, clean up after failure, and publish without replacing existing files. Concurrent same-name uploads cannot overwrite each other. Folder creation validates names and does not replace existing entries.
- File names, paths, queries, and preview contents are escaped. JSON, Markdown, and other supported text are displayed as plain text; embedded markup is not executed. Invalid UTF-8, binary controls, and oversized previews are rejected.
- Downloads use attachment disposition, `application/octet-stream`, `nosniff`, a restrictive sandbox CSP, and no-store caching. The separate download listener does not serve HTML listings, text previews, or owner endpoints.
- Search checks at most 10,000 entries, descends at most 64 folder levels, and returns at most 1,000 matches with an explicit incomplete-results notice. Ordinary listings have the same entry/result bounds. Folder-size, quota, and update-date scans use bounded 10,000-entry/64-level budgets. Supported text and image previews are limited to 100 MiB; uploads default to 10 GiB per file and stream to disk. Storage and concurrency limits are documented in README and `.env.example`. Limits use 429 with Retry-After, 507 for capacity, or 503 when usage cannot be safely measured.
- Successful live HTML responses include a same-origin CSP, `X-Frame-Options: SAMEORIGIN`, `nosniff`, and a referrer policy. Production mode is explicit and is tested not to expose source on an error even when `NODE_ENV=development`.
- No `.env` files are tracked in the current checkout. Uploaded files are ignored by Git. Files in the public stash are intentionally public; credentials and password exports must stay outside it and outside the public static directories.

## Original live checks — 2026-10-14

These are historical observations. The 2026-10-15 follow-up below records the newer Files checks.

| Check | Observed result |
| --- | --- |
| HTTPS root and Files HEAD | 200; CSP, SAMEORIGIN, nosniff present; HSTS absent |
| HTTPS upload and mkdir with no credentials | 401 |
| HTTPS upload with a deliberately wrong bearer token | 401 |
| HTTP upload with forged `X-Forwarded-Proto: https` | 403 |
| Cross-origin owner preflight | 405; no Access-Control-Allow-Origin |
| `/files/.env` and encoded traversal | 403 |
| Invalid UTF-8 URL escape | 400 |
| `/.env` | 404 |
| HTTP Files GET with an XP/IE8 user agent | 200; token field and owner tools absent |

## Validation and deployment

The original syntax/markup checks, build, and all 75 tests passed on Bun 1.4.3; the latest 2026-10-15 suite contains 107 passing tests. Checks exercise trusted versus untrusted peers, HTTPS enforcement, HSTS, cancellation/abort recovery, concurrent storage reservations, capacity failure, and uncountable-tree rejection. Tests include the static-file disclosure regression and existing authentication, traversal, symlink/hardlink, root-pinning, escaping, upload-limit, cleanup, and download-listener protections. The original toolbar refresh glyph check used real IE8 with a self-hosted, licensed EOT subset; the obsolete bitmap fallback was removed.

Before deployment, use Bun 1.4.3 or newer, set the actual trusted home proxy peer IP and the intended private bind address, and review the default storage/concurrency limits. Run one application writer per file stash; quota reservations are process-local and assume the private tree is not concurrently modified by another writer. Proxy rate limits, service memory limits, and filesystem permissions remain part of the owner-managed server configuration. Deploy only after validating the applicable Caddy configuration, then repeat live checks. No deployment or server reconfiguration was performed in this review. The [Bun security advisory page](https://github.com/oven-sh/bun/security/advisories) is a vendor reference for runtime maintenance, not proof that the deployed runtime is free of vulnerabilities.

## Checksum follow-up — 2026-10-14

The SHA-256 addition initially shared its four response slots with file listings and previews. An isolated test held four checksum computations and reproduced a 429 on a normal listing. This availability issue is fixed locally: checksum responses now use a separate pool, defaulting to two requests, configurable through `FILES_MAX_CONCURRENT_CHECKSUMS`. Busy checksum work leaves listing, preview, and download capacity available.

The checksum cache holds at most 1,000 verified digests and evicts the least recently used entries. Cache keys include device, inode, size, modification time, and change time, with nanosecond timestamps. Files are opened through the existing restricted path handling before cache lookup. File metadata is checked again before publishing or caching a digest; files changed during hashing return 409, and aborted computations are not cached.

Regression tests cover occupied checksum capacity alongside successful listings, previews and downloads; cancellation and recovery; cached requests avoiding file reads; invalidation after same-size edits and file replacement; changed-file rejection; bounded cache eviction; and invalid concurrency settings. All 84 tests, static checks, and the build passed on Bun 1.4.3. This follow-up is local; it does not verify the deployed proxy or server configuration.

## Files and autofill follow-up — 2026-10-15

No new actionable security finding was identified in the inspected application code. The changes below preserve the existing owner authentication, trusted-proxy HTTPS requirement, filesystem restrictions, and download protections. This is an application review, not a claim that the deployed infrastructure or browser extensions are vulnerability-free.

### Image previews

Supported raster images use an explicit MIME-type allowlist and file-signature checks before inline display. SVG, HTML, mismatched image signatures, and unsupported inline formats are rejected. Images over 100 MiB cannot be previewed. Raw previews stream from the restricted file descriptor with an explicit content type, `nosniff`, a sandbox CSP, no-store caching, and the existing page concurrency limit. Original file links still download attachments, and SHA-256 links still hash the original bytes. Regression tests cover supported formats, encoded names, invalid signatures, unsupported formats, oversized images, and cancellation recovery.

### Dynamic update date

The Files page calculates its displayed date from the latest downloadable file modification timestamp across the restricted public file tree, including files in nested folders. Folder timestamps and file change timestamps are excluded: metadata-only changes or empty folder creation must not replace the newest file's date with today's date. It reuses the descriptor-relative traversal and excludes hidden entries, links, disallowed mounts, and non-regular files. Each date scan is bounded to 10,000 entries and 64 levels and runs within an existing page slot. Empty stashes and incomplete scans show `unavailable`; HEAD requests do not perform the scan. No timestamp journal or new persistent state is introduced. The date is filesystem metadata matching the file list, not an upload audit log or file-authenticity guarantee.

Regression tests use historical file dates alongside newer folder and metadata timestamps. They cover nested edits, falling back to the next newest file after deletion, uploads without restarting the host, empty folders, search-independent dates, exclusion of hidden file timestamps, and unavailable results for empty or incomplete scans. Preview and checksum pages omit the stash-wide date.

### Password-manager autofill and legacy frames

The token remains a `type="password"` field named `password`, with `autocomplete="current-password"`, an associated label, and a stable `owner-token` ID. A hidden, non-secret `owner` username uses `autocomplete="username"`. Passwords are read from the field at action time, so extension fills do not depend on keyboard or input events. The application does not copy tokens into URLs or browser storage, and clears the token after each owner action. Selecting “Use token” only marks the local form ready; server authorization still occurs on upload or folder creation.

The owner reproduced a Proton Pass icon that could not open its menu inside the site's legacy frame layout, then confirmed with a screenshot that the same live field displayed the login menu on a direct `/files/` page. Proton's public [frame helper](https://github.com/ProtonMail/WebClients/blob/main/applications/pass-extension/src/app/content/utils/frame.ts) looks for `iframe` elements when locating the parent, whereas the site uses `frame` elements. This supports the observed compatibility diagnosis; it is not an authentication bypass.

Opening Webmaster tools inside a frame now navigates the top-level tab to the current folder and query with `#owner-tools`, opens the tools, and focuses the token. The navigation constructs its destination from the current page URL and does not add credentials. Public browsing retains the classic frame layout. CSP, framing policy, HTTPS checks, and bearer authorization were not relaxed to enable autofill.

Tests cover the framed-to-full-page destination, preservation of folder and search state, absence of token data in navigation, automatic opening and focus on the destination, no automatic credential submission, direct reading of an autofilled token, and avoiding focus changes during an upload. Chromium UI checks verified the transition and focused token. Proton's detection library recognized the visible password field in an isolated DOM check; this does not replace extension end-to-end testing. The owner confirmed the live standalone Proton menu, but all Proton Pass/Bitwarden combinations on Chrome and Firefox were not independently tested with signed-in extensions. See [Proton Pass guidance](https://proton.me/support/pass-browser-extension), [Bitwarden autofill guidance](https://bitwarden.com/help/auto-fill-browser/), and [Bitwarden linked custom fields](https://bitwarden.com/help/auto-fill-custom-fields/).

### Earlier autofill validation and live status

`bun run check`, `bun run build`, `bun run test`, and `git diff --check` passed on Bun 1.4.3. The suite reported **95 passed, 0 failed**. The initial sandboxed test attempt could not bind local listeners; the complete suite passed with local networking permitted. Expected failed-upload fixtures log their simulated error while their cleanup and reservation tests pass.

The 2026-10-15 live HTTPS `/files/` HEAD response returned 200 with HSTS, CSP, SAMEORIGIN, and `nosniff`. The public GET still served the older template without the dynamic update-date marker or the latest autofill help markup. The full-page webmaster navigation is verified locally and remains undeployed. These observations do not establish the deployed runtime version, proxy trust configuration, authenticated upload behavior, or the status of other routes. No deployment, real authenticated upload, or server reconfiguration was performed.

## Folder ZIP and date correction follow-up — 2026-10-15

Reviewed the final local diff in `file-host.js`, the new `zip.js` stream writer, the Files template, markup checks, and regression tests. Rechecked integration with the existing path restrictions, authentication and proxy policy, upload quotas, attachment headers, and response-slot cleanup. No new unresolved application security finding was identified in this scope. This follow-up did not repeat the earlier live checks, audit infrastructure, inspect download contents, or assess current vendor advisories.

### Folder-only scope and filesystem boundaries

`/files/<folder>/?download=1` returns only downloadable regular files directly in that folder. The root route has the same behavior. Subfolders are not traversed and search filters do not select archive contents. The UI states this explicitly and omits the archive action from preview and checksum pages.

Planning and streaming both use the pinned directory descriptor and existing `O_NOFOLLOW`, device, mount, and single-link checks. Hidden names, symlinks, hard-linked files, and non-regular entries are excluded. Archive members contain only validated basenames; slash, backslash, control characters, and leading-dot paths remain prohibited. A downloadable filename containing a colon makes the archive request fail with 422 before streaming, preventing drive-qualified paths and alternate stream names from entering the ZIP. Individual file downloads remain available.

Files are reopened through the restricted directory immediately before reading. Device, inode, size, link count, and nanosecond modification/change timestamps are checked against the planned version and checked again after reading. A removed, replaced, shortened, or edited file interrupts the archive rather than producing a successful partial listing or following a replacement link. Once response headers have been sent, such failures terminate the stream instead of returning a new HTTP status. This remains subject to the existing trusted-local-writer assumption; archives are not transactional filesystem snapshots or authenticity guarantees.

### Resource and download protections

Planning examines at most 10,000 immediate directory entries, including rejected/hidden entries in the budget. Exceeding that budget returns 413 before sending an archive rather than silently omitting files. Folders without eligible direct files return 404. HEAD returns attachment headers without enumerating files or reading their contents.

File bytes stream in chunks of at most 64 KiB with backpressure, one file descriptor at a time. Only bounded entry metadata and ZIP central-directory records are retained. ZIPs use stored entries, with CRC-32 and ZIP64 sizes/offsets where needed; no archive compression, child process, temporary archive file, new production dependency, or persistent archive cache is introduced. The record format was checked against the [PKWARE ZIP specification](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT).

Archive planning and response bodies occupy the existing download slots. Completion, error, body cancellation, and request abort close active file/directory descriptors and release the slot. Busy archives return 429 with `Retry-After`; browsing and checksum pools remain separate. Archive responses use attachment disposition, `application/zip`, `nosniff`, no-store caching, a sandbox CSP, and no referrer. Both application listeners support archive attachments; the separate download listener still rejects directory HTML and previews. The existing Caddy example routes folder URLs to the website listener; its proxy configuration was not changed or validated here.

### Validation and remaining limits

`bun run check`, `bun run build`, `bun run test`, and `git diff --check` passed on Bun 1.4.3. The final suite reported **107 passed, 0 failed**. Tests cover direct-only root/nested archive contents, original bytes and Unicode names, empty files/folders, hidden and linked files, unsafe extraction paths, traversal, root replacement, file edits and symlink replacement during streaming, cancellation/abort recovery, the entry budget, ZIP64 header generation for a sparse file over 4 GiB, and attachment/security headers on both listeners. Existing authentication, trusted-proxy, quota, and escaping regressions also pass.

The independent `unzip -t` check passes for ordinary generated archives, including Unicode/binary members. A separate sparse ZIP64 fixture containing a 4 GiB + 1 byte file also passed the full independent CRC/integrity check. This large-file check verifies the ZIP writer without allocating a multi-gigabyte in-memory buffer; it is not a load test or a full HTTP transfer of that size.

Chromium screenshots at the default desktop size and 375-pixel width verified the new action's appearance and wrapping; the narrow document had no horizontal overflow. No new browser script is required. A browser-session MutationObserver error appeared in the automation logs; no site source uses MutationObserver, so this was not attributed to this change. Real XP/IE8 extraction, all third-party unzip tools, deployed proxies, authenticated live operations, and live archive responses were not tested in this follow-up. No deployment was performed.
