import { json } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
	try {
		const { slug, title, body, password } = await request.json();
		if (!password || password !== env.ADMIN_PASS) {
			return json({ error: 'unauthorized' }, { status: 401 });
		}
		if (!slug || !title || !body) {
			return json({ error: 'missing fields' }, { status: 400 });
		}
		const postsDir = path.join(process.cwd(), 'src', 'posts');
		if (!existsSync(postsDir)) {
			await mkdir(postsDir, { recursive: true });
		}
		const date = new Date().toISOString().split('T')[0];
		const fileContent = `---\ntitle: ${title}\ndate: ${date}\n---\n\n${body}`;
		const filePath = path.join(postsDir, `${slug}.md`);
		await writeFile(filePath, fileContent, 'utf-8');
		return json({ ok: true, slug });
	} catch (e) {
		console.error(e);
		return json({ error: String(e) }, { status: 500 });
	}
}
