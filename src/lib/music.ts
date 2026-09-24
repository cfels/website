export type Track = {
	id: string;
	title: string;
	artist: string;
	album: string;
	url: string;
};

const formatFolders = new Set([
	'mp3',
	'mpeg',
	'flac',
	'wav',
	'wave',
	'ogg',
	'oga',
	'opus',
	'm4a',
	'm4b',
	'mp4',
	'aac',
	'alac',
	'aiff',
	'aif',
	'wma',
	'webm'
]);

const audioModules = import.meta.glob(
	'$lib/assets/music/**/*.{mp3,mpeg,flac,wav,ogg,oga,opus,m4a,m4b,mp4,aac,alac,aiff,aif,wma,webm}',
	{ eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

const mascotModules = import.meta.glob('$lib/assets/uma/*.{gif,webp,apng}', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

function tidy(value: string): string {
	return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTrack(path: string, url: string, position: number): Track {
	const relative = path.replace(/^.*\/assets\/music\//, '');
	const segments = relative.split('/');
	const file = segments.pop() ?? relative;
	const albums = segments
		.filter((segment) => !formatFolders.has(segment.toLowerCase()))
		.map((segment) => tidy(segment.replace(/^\d+[\s._-]*/, '')))
		.filter((segment) => segment.length > 0);
	const base = tidy(file.replace(/\.[^.]+$/, ''));
	const parts = base.split(/\s+-\s+/);
	const artist = parts.length > 1 ? parts[0] : '';
	const title = parts.length > 1 ? parts.slice(1).join(' - ') : base;
	return {
		id: `track-${position}`,
		title: title || base || file,
		artist,
		album: albums.length ? albums[albums.length - 1] : 'singles',
		url
	};
}

function byPath(a: [string, string], b: [string, string]): number {
	return a[0].localeCompare(b[0], 'en', { numeric: true, sensitivity: 'base' });
}

export const tracks: Track[] = Object.entries(audioModules)
	.sort(byPath)
	.map(([path, url], position) => toTrack(path, url, position));

export const mascots: string[] = Object.entries(mascotModules)
	.sort(byPath)
	.map(([, url]) => url);
