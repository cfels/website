import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { error } from '@sveltejs/kit';
import path from 'path';

export async function load({ params }) {
	const filePath = path.join(process.cwd(), 'src', 'posts', `${params.slug}.md`);

	if (!existsSync(filePath)) {
		throw error(404, 'post not found');
	}

	const raw = await readFile(filePath, 'utf-8');

	const titleMatch = raw.match(/^title:\s*(.+)$/m);
	const dateMatch = raw.match(/^date:\s*(.+)$/m);
	const body = raw.replace(/^---[\s\S]+?---\n*/m, '').trim();

	return {
		title: titleMatch?.[1]?.trim() ?? params.slug,
		date: dateMatch?.[1]?.trim() ?? '',
		body,
	};
}
