import { constants } from 'node:fs';
import { link, mkdir, open, opendir, readFile, statfs, unlink } from 'node:fs/promises';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Readable } from 'node:stream';

const readFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const directoryFlags = readFlags | constants.O_DIRECTORY;
export const defaultMaxUploadBytes = 10 * 1024 * 1024 * 1024;
const maxTextViewBytes = 10 * 1024 * 1024;
const maxFolderSizeEntries = 10000;
const maxFolderSizeDepth = 64;
const maxSearchEntries = 10000;
const maxSearchDepth = 64;
const maxSearchResults = 1000;
const hiddenErrors = new Set(['ENOENT', 'ENOTDIR', 'ELOOP', 'EACCES', 'EPERM']);
const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer'
};

function validName(name) {
  return name.length > 0 && !name.startsWith('.') && !/[\u0000-\u001f\u007f/\\]/u.test(name) && Buffer.byteLength(name) <= 255;
}

function encodeName(name) {
  return encodeURIComponent(name).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function fileURL(parts, directory = false) {
  return `/files/${parts.map(encodeName).join('/')}${directory && parts.length ? '/' : ''}`;
}

function isTextFile(name) {
  return /\.(txt|md|json|log|csv|tsv|yaml|yml|toml|ini|cfg|conf|fgconfig)$/i.test(name) || /^readme$/i.test(name);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function formatSize(size) {
  if (size < 1024) return `${size} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let unit = -1;
  do {
    size /= 1024;
    unit++;
  } while (size >= 1024 && unit < units.length - 1);
  return `${size.toFixed(1)} ${units[unit]}`;
}

function failure(message, status) {
  return new Response(message, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

async function mountID(handle) {
  const info = await readFile(`/proc/self/fdinfo/${handle.fd}`, 'utf8');
  const id = info.match(/^mnt_id:\s+(\d+)$/m)?.[1];
  if (!id) throw new Error('Cannot verify the file host mount boundary.');
  return id;
}

export async function createFileHost(rootPath, template, {
  uploadToken = '', maxUploadBytes = defaultMaxUploadBytes,
  isSecureRequest = () => false, maxStorageBytes = 100 * 1024 * 1024 * 1024,
  minFreeBytes = 1024 * 1024 * 1024, maxConcurrentPages = 4,
  maxConcurrentDownloads = 16, maxConcurrentUploads = 2
} = {}) {
  if (process.platform !== 'linux') throw new Error('The file host requires Linux and /proc for restricted filesystem access.');
  if (uploadToken && uploadToken.length < 32) throw new Error('FILES_UPLOAD_TOKEN must contain at least 32 characters.');
  if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1) throw new Error('The upload size limit must be a positive integer.');
  if (!Number.isSafeInteger(maxStorageBytes) || maxStorageBytes < 1) throw new Error('The storage limit must be a positive integer.');
  if (!Number.isSafeInteger(minFreeBytes) || minFreeBytes < 0) throw new Error('The free-space reserve must be a nonnegative integer.');
  if ([maxConcurrentPages, maxConcurrentDownloads, maxConcurrentUploads].some(value => !Number.isSafeInteger(value) || value < 1 || value > 1024)) throw new Error('Concurrency limits must be integers between 1 and 1024.');
  if (typeof isSecureRequest !== 'function') throw new Error('A request security policy is required.');
  const pageSlots = { active: 0, limit: maxConcurrentPages };
  const downloadSlots = { active: 0, limit: maxConcurrentDownloads };
  let activeMutations = 0;
  let reservedBytes = 0;
  let publishedBytes = 0n;
  let publishedEntries = 0n;

  const root = await open(rootPath, directoryFlags);
  let rootStat;
  let rootMountID;
  try {
    rootStat = await root.stat();
    rootMountID = await mountID(root);
  } catch (error) {
    await root.close();
    throw error;
  }
  const tokenHash = uploadToken ? createHash('sha256').update(uploadToken).digest() : null;

  async function boundedResponse(slots, request, action) {
    if (slots.active >= slots.limit) return new Response('Too many active requests; try again shortly', { status: 429, headers: { ...pageHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '1' } });
    slots.active++;
    let streaming = false;
    try {
      const response = await action();
      if (!response.body) return response;
      const reader = response.body.getReader();
      let released = false;
      function release() {
        if (released) return;
        released = true;
        slots.active--;
        request.signal.removeEventListener('abort', abort);
        reader.releaseLock();
      }
      function abort() {
        reader.cancel().then(release, release);
      }
      request.signal.addEventListener('abort', abort, { once: true });
      if (request.signal.aborted) {
        await reader.cancel();
        release();
        streaming = true;
        return new Response(null, { status: 499 });
      }
      const body = new ReadableStream({
        async pull(controller) {
          try {
            const { value, done } = await reader.read();
            if (released) return;
            if (done) {
              controller.close();
              release();
            } else controller.enqueue(value);
          } catch (error) {
            if (!released) {
              controller.error(error);
              release();
            }
          }
        },
        async cancel(reason) {
          try { await reader.cancel(reason); }
          finally { release(); }
        }
      });
      streaming = true;
      return new Response(body, response);
    } finally {
      if (!streaming) slots.active--;
    }
  }

  async function openEntry(directory, name, flags = readFlags) {
    // Descriptor-relative opens and O_NOFOLLOW keep each path component inside the pinned directory.
    const handle = await open(`/proc/self/fd/${directory.fd}/${name}`, flags);
    try {
      const stat = await handle.stat();
      if (stat.dev !== rootStat.dev || (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)) || await mountID(handle) !== rootMountID) {
        await handle.close();
        return null;
      }
      return { handle, stat };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async function openPath(parts, finalFlags = readFlags) {
    let handle = root;
    let stat = rootStat;
    try {
      for (const [index, part] of parts.entries()) {
        const entry = await openEntry(handle, part, index < parts.length - 1 ? directoryFlags : finalFlags);
        if (handle !== root) await handle.close();
        handle = root;
        if (!entry) return null;
        ({ handle, stat } = entry);
      }
      return { handle, stat };
    } catch (error) {
      if (handle !== root) await handle.close();
      throw error;
    }
  }

  async function folderSize(directory, budget, depth = 0) {
    if (depth >= maxFolderSizeDepth) return null;
    let size = 0;
    try {
      for await (const { name } of await opendir(`/proc/self/fd/${directory.fd}`)) {
        if (budget.remaining-- <= 0) return null;
        if (!validName(name)) continue;
        let entry;
        try {
          entry = await openEntry(directory, name);
          if (!entry) continue;
          const bytes = entry.stat.isDirectory() ? await folderSize(entry.handle, budget, depth + 1) : entry.stat.size;
          if (bytes === null) return null;
          size += bytes;
          if (!Number.isSafeInteger(size)) return null;
        } catch (error) {
          if (!hiddenErrors.has(error.code)) throw error;
        } finally {
          if (entry) await entry.handle.close();
        }
      }
      return size;
    } catch (error) {
      if (hiddenErrors.has(error.code)) return null;
      throw error;
    }
  }

  async function directoryPage(request, handle, parts) {
    const query = (new URL(request.url).searchParams.get('q') || '').trim();
    if (query.length > 255) return failure('Search is limited to 255 characters', 400);
    if (request.method === 'HEAD') return new Response(null, { headers: pageHeaders });
    const search = query.toLowerCase();
    const entries = [];
    const sizeBudget = { remaining: maxFolderSizeEntries };
    let remaining = maxSearchEntries;
    let searchLimited = false;
    async function collectEntries(directory, parentParts, depth = 0) {
      for await (const { name } of await opendir(`/proc/self/fd/${directory.fd}`)) {
        if (remaining-- <= 0) {
          searchLimited = true;
          return;
        }
        if (!validName(name)) continue;
        let entry;
        try {
          entry = await openEntry(directory, name);
          if (!entry) continue;
          const isDirectory = entry.stat.isDirectory();
          const entryParts = [...parentParts, name];
          if (!search || name.toLowerCase().includes(search)) {
            if (entries.length >= maxSearchResults) {
              searchLimited = true;
              remaining = 0;
              return;
            }
            const size = isDirectory ? await folderSize(entry.handle, sizeBudget) : entry.stat.size;
            entries.push({ name, parts: entryParts, directory: isDirectory, size, modified: entry.stat.mtime.toISOString() });
          }
          if (search && isDirectory) {
            if (depth + 1 > maxSearchDepth) searchLimited = true;
            else await collectEntries(entry.handle, entryParts, depth + 1);
            if (searchLimited && remaining <= 0) return;
          }
        } catch (error) {
          if (!hiddenErrors.has(error.code)) throw error;
        } finally {
          if (entry) await entry.handle.close();
        }
      }
    }
    await collectEntries(search ? root : handle, search ? [] : parts);
    entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.parts.join('/').localeCompare(b.parts.join('/'), 'en'));
    let rows = parts.length ? `<tr><td><a href="${fileURL(parts.slice(0, -1), true)}">..\\ (parent folder)</a></td><td>Folder</td><td>—</td></tr>` : '';
    rows += entries.map(entry => {
      const url = fileURL(entry.parts, entry.directory);
      const name = search ? entry.parts.join('\\') : entry.name;
      const view = !entry.directory && isTextFile(entry.name) ? ` <a class="file-view-link" href="${url}?view=1" aria-label="View ${escapeHTML(name)}">View</a>` : '';
      const size = entry.size === null ? '—' : formatSize(entry.size);
      return `<tr><td><a${entry.directory ? '' : ' class="file-download-link"'} href="${url}">${escapeHTML(name)}${entry.directory ? '\\' : ''}</a>${view}</td><td${entry.directory ? ' title="Total size of downloadable files in this folder and its subfolders"' : ''}>${size}</td><td><time datetime="${entry.modified}">${entry.modified.slice(0, 10)}</time></td></tr>`;
    }).join('');
    if (!entries.length) rows += `<tr><td colspan="3">${query ? 'No matching files or folders.' : 'No files here yet :p'}</td></tr>`;

    const response = new HTMLRewriter()
      .on('#folder-path', { element: element => element.setInnerContent(`C:\\files\\${parts.length ? parts.join('\\') + '\\' : ''}`) })
      .on('#file-search', { element: element => element.setAttribute('action', '/files/') })
      .on('#file-query', { element: element => element.setAttribute('value', escapeHTML(query)) })
      .on('#search-clear', { element: element => element.setAttribute('href', fileURL(parts, true)) })
      .on('#file-search-results', { element: element => {
        if (query) {
          element.removeAttribute('hidden');
          element.setInnerContent(`${entries.length} ${entries.length === 1 ? 'match' : 'matches'} for “${query}” across all folders.${searchLimited ? ' Search limits reached; these results may be incomplete. Browse folders to see more files.' : ''}`);
        } else if (searchLimited) {
          element.removeAttribute('hidden');
          element.setInnerContent('Folder listing limits reached; some entries are omitted. Search by name or organize files into smaller folders.');
        }
      } })
      .on('#file-entries', { element: element => element.setInnerContent(rows, { html: true }) })
      .on('#folder-size-note', { element: element => {
        if (entries.some(entry => entry.size === null)) element.setInnerContent('Folder sizes include downloadable files in subfolders. A dash means its size is unavailable; open the folder to browse its contents.');
      } })
      .on('#text-viewer', { element: element => element.remove() })
      .on('#owner-tools', { element: element => {
        if (!tokenHash || isSecureRequest(request) !== true) element.remove();
        else element.setAttribute('data-folder', encodeName(parts.join('/')));
      } })
      .on('#owner-refresh a', { element: element => element.setAttribute('href', fileURL(parts, true)) })
      .on('#upload-file', { element: element => element.setAttribute('data-max-size', String(maxUploadBytes)) })
      .on('#upload-limit', { element: element => element.setInnerContent(formatSize(maxUploadBytes)) })
      .transform(new Response(template, { headers: pageHeaders }));
    return response;
  }

  async function textFilePage(request, handle, stat, parts) {
    const name = parts.at(-1);
    let content = '';
    let message = '';
    let status = 200;
    if (!isTextFile(name)) {
      message = 'This file type cannot be previewed here. Download this file instead.';
      status = 415;
    } else {
      const chunks = [];
      let size = 0;
      if (stat.size <= maxTextViewBytes) {
        while (size <= maxTextViewBytes) {
          const buffer = Buffer.alloc(Math.min(64 * 1024, maxTextViewBytes + 1 - size));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, size);
          if (!bytesRead) break;
          chunks.push(buffer.subarray(0, bytesRead));
          size += bytesRead;
        }
      }
      if (stat.size > maxTextViewBytes || size > maxTextViewBytes) {
        message = `This file is too large to view here. The viewer supports files up to ${formatSize(maxTextViewBytes)}; you can still download it.`;
        status = 413;
      } else {
        try {
          content = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
          if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)) throw new Error('Binary content');
          if (!content) message = 'This file is empty.';
        } catch {
          content = '';
          message = 'This file is not UTF-8 text. Download it to open it on your computer.';
          status = 415;
        }
      }
    }
    if (request.method === 'HEAD') return new Response(null, { status, headers: pageHeaders });
    return new HTMLRewriter()
      .on('title', { element: element => element.setInnerContent(`Moxiu / ${name}`) })
      .on('.page-heading h1', { element: element => element.setInnerContent('Text file viewer ☆') })
      .on('.page-heading p', { element: element => element.setInnerContent('Notes & explanations') })
      .on('.breadcrumb', { element: element => element.setInnerContent(`<a href="/home.html">Home</a> &gt; <a href="${fileURL(parts.slice(0, -1), true)}">Files</a> &gt; ${escapeHTML(name)}`, { html: true }) })
      .on('#folder-path', { element: element => element.setInnerContent(`C:\\files\\${parts.join('\\')}`) })
      .on('.personal-copy', { element: element => element.setInnerContent('Read the notes below, or download the file.') })
      .on('#file-search, #file-search-results, .file-list, #folder-size-note, #owner-tools', { element: element => element.remove() })
      .on('#text-viewer', { element: element => element.removeAttribute('hidden') })
      .on('#text-back', { element: element => element.setAttribute('href', fileURL(parts.slice(0, -1), true)) })
      .on('#text-download', { element: element => element.setAttribute('href', fileURL(parts)) })
      .on('#text-message', { element: element => {
        if (message) {
          element.removeAttribute('hidden');
          element.setInnerContent(message);
        }
      } })
      .on('.text-file-content', { element: element => { if (!content) element.remove(); } })
      .on('#text-content', { element: element => element.setInnerContent(content) })
      .transform(new Response(template, { status, headers: pageHeaders }));
  }

  async function download(request, pathname, { attachmentOnly = false } = {}) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (attachmentOnly && new URL(request.url).searchParams.get('view') === '1') return failure('Not found', 404);
    const parts = pathname.slice('/files/'.length).split('/');
    if (parts.at(-1) === '') parts.pop();
    if (parts.some(part => !validName(part))) return failure('Forbidden', 403);
    let entry;
    let streaming = false;
    try {
      entry = await openPath(parts);
      if (!entry) return failure('Not found', 404);
      const { handle, stat } = entry;
      if (stat.isDirectory()) {
        if (!pathname.endsWith('/')) return new Response(null, { status: 308, headers: { Location: fileURL(parts, true) } });
        if (attachmentOnly) return failure('Not found', 404);
        return await boundedResponse(pageSlots, request, () => directoryPage(request, handle, parts));
      }
      if (pathname.endsWith('/')) return failure('Not found', 404);
      if (new URL(request.url).searchParams.get('view') === '1') return await boundedResponse(pageSlots, request, () => textFilePage(request, handle, stat, parts));
      const name = parts.at(-1);
      const fallbackName = name.replace(/[^\x20-\x7e]|["%:<>?*|]/g, '_');
      const headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeName(name)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer'
      };
      if (request.method === 'HEAD') return new Response(null, { headers: { ...headers, 'Content-Length': String(stat.size) } });
      return await boundedResponse(downloadSlots, request, () => {
        const body = Readable.toWeb(handle.createReadStream());
        streaming = true;
        return new Response(body, { headers });
      });
    } catch (error) {
      if (hiddenErrors.has(error.code)) return failure('Not found', 404);
      console.error('File download failed:', error.code || error.name);
      return failure('Unable to read files', 500);
    } finally {
      if (entry && entry.handle !== root && !streaming) await entry.handle.close();
    }
  }

  function authorize(request) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    if (!tokenHash) return failure('Uploads are not configured', 503);
    if (isSecureRequest(request) !== true) return failure('Owner actions require HTTPS', 403);
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ') || !timingSafeEqual(tokenHash, createHash('sha256').update(authorization.slice(7)).digest())) {
      return failure('Invalid owner token', 401);
    }
    if (request.headers.get('sec-fetch-site') === 'cross-site') return failure('Forbidden', 403);
    return null;
  }

  function mutationTarget(request) {
    let name;
    let parts;
    try {
      name = decodeURIComponent(request.headers.get('x-file-name') || '');
      const folder = decodeURIComponent(request.headers.get('x-file-folder') || '');
      parts = folder ? folder.split('/') : [];
    } catch {
      return failure('Invalid name or folder', 400);
    }
    if (!validName(name)) return failure('Use a plain filename without folders or a leading dot', 400);
    if (parts.some(part => !validName(part))) return failure('Invalid folder', 400);
    return { name, parts };
  }

  async function reserveStorage(required) {
    const byteRevision = publishedBytes;
    const entryRevision = publishedEntries;
    const budget = { remaining: maxFolderSizeEntries };
    const storedBytes = await folderSize(root, budget);
    if (storedBytes === null || budget.remaining < activeMutations) return failure('Storage usage cannot be verified; owner actions are temporarily unavailable', 503);
    const space = await statfs(`/proc/self/fd/${root.fd}`, { bigint: true });
    if (BigInt(budget.remaining) < BigInt(activeMutations) + publishedEntries - entryRevision) return failure('Storage entry limit reached', 507);
    const pendingBytes = BigInt(reservedBytes) + BigInt(required);
    if (BigInt(storedBytes) + pendingBytes + publishedBytes - byteRevision > BigInt(maxStorageBytes) || space.bavail * space.bsize - pendingBytes < BigInt(minFreeBytes)) return failure('Upload storage limit or free-space reserve reached', 507);
    reservedBytes += required;
    return null;
  }

  async function createFolder(request) {
    const unauthorized = authorize(request);
    if (unauthorized) return unauthorized;
    const target = mutationTarget(request);
    if (target instanceof Response) return target;
    if (request.body) return failure('Folder actions do not accept a request body', 400);
    if (activeMutations >= maxConcurrentUploads) return new Response('Too many active owner actions; try again shortly', { status: 429, headers: { 'Retry-After': '1', 'Cache-Control': 'no-store' } });
    activeMutations++;
    let directory;
    try {
      const unavailable = await reserveStorage(0);
      if (unavailable) return unavailable;
      directory = await openPath(target.parts, directoryFlags);
      if (!directory) return failure('Folder not found', 404);
      await mkdir(`/proc/self/fd/${directory.handle.fd}/${target.name}`, { mode: 0o700 });
      publishedEntries++;
      return Response.json({ name: target.name, url: fileURL([...target.parts, target.name], true) }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error.code === 'EEXIST') return failure('That name already exists; choose another name', 409);
      if (hiddenErrors.has(error.code)) return failure('Folder not found', 404);
      console.error('Folder creation failed:', error.code || error.name);
      return failure('Unable to create folder', 500);
    } finally {
      try {
        if (directory && directory.handle !== root) await directory.handle.close();
      } finally {
        activeMutations--;
      }
    }
  }

  async function upload(request) {
    const unauthorized = authorize(request);
    if (unauthorized) return unauthorized;
    const target = mutationTarget(request);
    if (target instanceof Response) return target;
    if (Number(request.headers.get('content-length')) > maxUploadBytes) return failure('File is too large', 413);
    if (activeMutations >= maxConcurrentUploads) return new Response('Too many active owner actions; try again shortly', { status: 429, headers: { 'Retry-After': '1', 'Cache-Control': 'no-store' } });
    activeMutations++;

    let directory;
    let temporaryPath;
    let temporary;
    let reader;
    let size = 0;
    let reservation = 0;
    try {
      const declared = request.headers.get('content-length');
      if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) return failure('Invalid upload length', 400);
      const required = request.body ? (declared === null ? maxUploadBytes : Number(declared)) : 0;
      const unavailable = await reserveStorage(required);
      if (unavailable) return unavailable;
      reservation = required;
      directory = await openPath(target.parts, directoryFlags);
      if (!directory) return failure('Folder not found', 404);
      const directoryPath = `/proc/self/fd/${directory.handle.fd}`;
      temporaryPath = `${directoryPath}/.upload-${randomUUID()}`;
      temporary = await open(temporaryPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      if (request.body) {
        reader = request.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxUploadBytes) {
            await reader.cancel();
            return failure('File is too large', 413);
          }
          if (size > reservation) {
            await reader.cancel();
            return failure('Upload exceeds its reserved size', 400);
          }
          let offset = 0;
          while (offset < value.byteLength) {
            const { bytesWritten } = await temporary.write(value, offset, value.byteLength - offset);
            if (!bytesWritten) throw new Error('Upload write failed');
            offset += bytesWritten;
          }
        }
      }
      await temporary.sync();
      await link(temporaryPath, `${directoryPath}/${target.name}`);
      publishedBytes += BigInt(size);
      publishedEntries++;
      return Response.json({ name: target.name, url: fileURL([...target.parts, target.name]), size }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (error.code === 'EEXIST') return failure('That filename already exists; choose another name', 409);
      if (hiddenErrors.has(error.code)) return failure('Folder not found', 404);
      console.error('File upload failed:', error.code || error.name);
      return failure('Upload failed', 500);
    } finally {
      if (reader) reader.releaseLock();
      try {
        if (temporary) {
          await temporary.close();
          await unlink(temporaryPath);
        }
      } finally {
        try {
          if (directory && directory.handle !== root) await directory.handle.close();
        } finally {
          reservedBytes -= reservation;
          activeMutations--;
        }
      }
    }
  }

  return { download, upload, createFolder, close: () => root.close() };
}
