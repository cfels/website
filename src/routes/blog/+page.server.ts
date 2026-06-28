import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function load() {
	const postsDir = path.join(process.cwd(), 'src', 'posts');

	if (!existsSync(postsDir)) return { posts: [] };

	const files = await readdir(postsDir);
	const mdFiles = files.filter(f => f.endsWith('.md'));

	const posts = await Promise.all(
		mdFiles.map(async (file) => {
			const content = await readFile(path.join(postsDir, file), 'utf-8');
			const slug = file.replace('.md', '');
			const titleMatch = content.match(/^title:\s*(.+)$/m);
			const dateMatch = content.match(/^date:\s*(.+)$/m);
			return {
				slug,
				title: titleMatch?.[1]?.trim() ?? slug,
				date: dateMatch?.[1]?.trim() ?? '',
			};
		})
	);

	posts.sort((a, b) => (a.date < b.date ? 1 : -1));
	return { posts };
}
