import { execSync } from 'child_process';

export function load() {
	let lastUpdated: string;
	try {
		const raw = execSync('git log -1 --format=%ci', { cwd: process.cwd() }).toString().trim();
		lastUpdated = raw.slice(0, 10);
	} catch {
		lastUpdated = new Date().toISOString().slice(0, 10);
	}
	return { lastUpdated };
}
