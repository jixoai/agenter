type MessageAppViewRoom = {
	chatId: string;
	title?: string | null;
	transportUrl?: string | null;
};

export interface BuildMessageAppViewRoomUrlInput {
	appViewBaseUrl: string | null | undefined;
	room: MessageAppViewRoom | null;
	viewerContactId: string | null;
	viewerAccessToken: string | null;
}

const withViewerToken = (transportUrl: string, token: string): string => {
	const url = new URL(transportUrl);
	url.searchParams.set('token', token);
	return url.toString();
};

export const buildMessageAppViewRoomUrl = (input: BuildMessageAppViewRoomUrlInput): string | null => {
	const base = input.appViewBaseUrl?.trim();
	const room = input.room;
	const viewerContactId = input.viewerContactId?.trim();
	const viewerAccessToken = input.viewerAccessToken?.trim();
	const transportUrl = room?.transportUrl?.trim();
	if (!base || !room || !viewerContactId || !viewerAccessToken || !transportUrl) {
		return null;
	}

	const url = new URL(base);
	url.searchParams.set('mode', 'room');
	url.searchParams.set('room', room.chatId);
	url.searchParams.set('url', withViewerToken(transportUrl, viewerAccessToken));
	url.searchParams.set('token', viewerAccessToken);
	url.searchParams.set('viewer', viewerContactId);
	url.searchParams.set('name', room.title?.trim() || room.chatId);
	return url.toString();
};
