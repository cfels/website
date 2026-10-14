# Website security review — 2026-10-14

The concrete application findings from this review are fixed in this checkout and covered by regression tests. The changes have not been deployed. Public XP/IE8 HTTP browsing remains read-only at the owner's explicit request; its lack of transport integrity is an accepted compatibility risk, not a claim of zero risk. The owner confirmed that the servers are configured correctly; their configuration was not independently audited.

## Scope and evidence

Reviewed `server.js`, `file-host.js`, `request-policy.js`, all browser scripts and HTML, security headers, asset/build scripts, environment configuration, `Caddyfile.example`, and the two-proxy configuration supplied in the chat. Reviewed authentication, CSRF/CORS, escaping, downloads/previews, traversal and filesystem boundaries, upload atomicity, error disclosure, and resource limits. No application package dependencies are declared; the final runtime used for checks was Bun 1.4.3. Its official release archive was verified against the vendor checksum and run from a temporary test directory; the system Bun installation was not changed.

Ran the complete automated suite, static checks, build, and real XP/IE8 visual checks. Live requests to `moxiu.vacpro.fyi` used HEAD, public-page GET, OPTIONS, and empty POST requests with missing or deliberately invalid credentials. No real upload token was read or sent, and no live files were created or changed.

The deployed OS/runtime versions, firewall rules, container permissions, proxy snippets, actual token strength, logs, backup/disk quotas, repository history, and download contents were not inspected. No load test, port scan, malware scan, or authenticated live upload was performed. The public static directories must remain under trusted deployment control; their canonical-path checks are not a sandbox against a concurrent hostile local writer.

## Findings

| Finding | Impact and evidence | Status |
| --- | --- | --- |
| Conditional file disclosure in static serving | A fake `build/.env` in an isolated fixture returned 200. The previous handler also followed public-tree symlinks without checking their destination. If credentials or outside links were accidentally deployed, visitors could retrieve them. | Fixed locally: decoded hidden paths, links to hidden targets, and links outside the public tree return 403. Regression checks cover GET and HEAD, including directory links. Links to ordinary public files still work. The live `/.env` request returned 404; no actual credential leak was observed. |
| Missing HSTS | The pre-deployment live HTTPS responses lacked a remembered HTTPS-only policy. | Fixed locally: both Bun listeners add HSTS only when HTTPS metadata comes from a trusted connecting peer. The home Caddy example also adds it only to requests from the verified VPS HTTPS route. Integration tests verify the header. Live verification follows deployment. |
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
- Search checks at most 10,000 entries, descends at most 64 folder levels, and returns at most 1,000 matches with an explicit incomplete-results notice. Ordinary listings have the same entry/result bounds. Folder-size and quota scans have a separate 10,000-entry/64-level budget. Previews read at most 10 MiB; uploads default to 10 GiB per file and stream to disk. Storage and concurrency limits are documented in README and `.env.example`. Limits use 429 with Retry-After, 507 for capacity, or 503 when usage cannot be safely measured.
- Successful live HTML responses include a same-origin CSP, `X-Frame-Options: SAMEORIGIN`, `nosniff`, and a referrer policy. Production mode is explicit and is tested not to expose source on an error even when `NODE_ENV=development`.
- No `.env` files are tracked in the current checkout. Uploaded files are ignored by Git. Files in the public stash are intentionally public; credentials and password exports must stay outside it and outside the public static directories.

## Live checks before these changes are deployed

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

The syntax/markup checks, build, and all 75 tests passed on Bun 1.4.3. Added checks exercise trusted versus untrusted peers, HTTPS enforcement, HSTS, cancellation/abort recovery, concurrent storage reservations, capacity failure, and uncountable-tree rejection. Tests include the new static-file disclosure regression and existing authentication, traversal, symlink/hardlink, root-pinning, escaping, upload-limit, cleanup, and download-listener protections. The toolbar refresh glyph was checked in real IE8 using a self-hosted, licensed EOT subset; the obsolete bitmap fallback was removed.

Before deployment, use Bun 1.4.3 or newer, set the actual trusted home proxy peer IP and the intended private bind address, and review the default storage/concurrency limits. Run one application writer per file stash; quota reservations are process-local and assume the private tree is not concurrently modified by another writer. Proxy rate limits, service memory limits, and filesystem permissions remain part of the owner-managed server configuration. Deploy only after validating the applicable Caddy configuration, then repeat live checks. No deployment or server reconfiguration was performed in this review. The [Bun security advisory page](https://github.com/oven-sh/bun/security/advisories) is a vendor reference for runtime maintenance, not proof that the deployed runtime is free of vulnerabilities.
