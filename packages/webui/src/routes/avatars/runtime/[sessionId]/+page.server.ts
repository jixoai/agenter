import { redirect } from '@sveltejs/kit';

export const load = ({ params }: { params: { sessionId: string } }) => {
	throw redirect(307, `/avatars/runtime/${encodeURIComponent(params.sessionId)}/attention`);
};
