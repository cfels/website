/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `uma-${version}`;
const MEDIA = /\.(?:gif|png|jpe?g|webp|avif|mp3|woff2?|ttf)$/;
const CORE = [...build, ...files].filter((path) => !MEDIA.test(path));

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(CORE))
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	if (request.headers.get('cache-control') === 'no-cache') return;

	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (CORE.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			try {
				const response = await fetch(request);
				if (response.status === 200 && response.type === 'basic') {
					cache.put(request, response.clone()).catch(() => {});
				}
				return response;
			} catch (error) {
				const cached = await cache.match(request);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});
