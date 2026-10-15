import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import sql from '../../app/api/utils/sql.js';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			secureCookie: process.env.AUTH_URL.startsWith('https'),
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
