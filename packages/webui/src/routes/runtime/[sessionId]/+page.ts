import { redirect } from '@sveltejs/kit';

export const load = ({ params }) => {
	throw redirect(307, `/runtime/${encodeURIComponent(params.sessionId)}/attention`);
};
