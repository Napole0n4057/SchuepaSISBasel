import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import sql from '../../app/api/utils/sql.js';

function normalizeEnvValue(rawValue) {
	if (typeof rawValue !== 'string') return undefined;
	const trimmed = rawValue.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/^['"]|['"]$/g, '');
}

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const authSecret = normalizeEnvValue(c.env.AUTH_SECRET ?? process.env.AUTH_SECRET);
		const authUrl = normalizeEnvValue(c.env.AUTH_URL ?? process.env.AUTH_URL);
		const token = await getToken({
			req: c.req.raw,
			secret: authSecret,
			secureCookie: authUrl?.startsWith('https') ?? false,
		});
		if (token && typeof token.sub === 'string') {
			const activeAccount = await sql`
				SELECT EXISTS (
					SELECT 1
					FROM auth_users au
					WHERE au.id = ${token.sub}
						AND NOT EXISTS (
							SELECT 1
							FROM user_roles ur
							WHERE ur.user_id = au.id
								AND (
									ur.designation IS NULL
									OR ur.designation NOT IN ('admin', 'member', 'spectator')
								)
						)
				) AS active
			`;
			if (activeAccount[0]?.active !== true) return undefined;

			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}
