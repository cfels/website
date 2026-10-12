import { cp, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
await rm(new URL('build/', root), { recursive: true, force: true });
await cp(new URL('static/', root), new URL('build/', root), { recursive: true });
console.log('Static frame documents copied to build/.');
