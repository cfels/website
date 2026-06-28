import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
	const { password } = await request.json();
	if (password === env.ADMIN_PASS) return json({ ok: true });
	return json({ error: 'wrong password' }, { status: 401 });
}
