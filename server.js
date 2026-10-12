import { resolve, sep } from 'node:path';

const root = resolve(import.meta.dir, process.argv.includes('--dev') ? 'static' : 'build');
if (!(await Bun.file(resolve(root, 'index.html')).exists())) {
  throw new Error('Run bun run build before starting the production server.');
}

const server = Bun.serve({
  port: process.env.PORT || 3000,
  hostname: process.env.HOST || '0.0.0.0',
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }

    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }
    if (pathname === '/donate') {
      return new Response(null, { status: 308, headers: { Location: '/donate/' } });
    }

    const path = resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    if (!path.startsWith(root + sep) || pathname.includes('\0') || pathname.includes('\\')) {
      return new Response('Forbidden', { status: 403 });
    }

    const file = Bun.file(path);
    const exists = await file.exists();
    const body = exists ? file : Bun.file(resolve(root, '404.html'));
    const etag = `W/"${body.size}-${body.lastModified}"`;
    const headers = {
      'Content-Type': body.type,
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
    if (exists && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(request.method === 'HEAD' ? null : body, { status: exists ? 200 : 404, headers });
  }
});

console.log(`Local: http://localhost:${server.port}`);
