export interface MessageRoomTabLabelInput {
	title?: string | null;
	chatId: string;
}

const normalizeRoomTabTitle = (title: string | null | undefined, chatId: string): string => {
	const trimmed = title?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : chatId;
};

const formatCompactRoomIdSuffix = (chatId: string): string => {
	return chatId.slice(-6);
};

export const resolveMessageRoomTabLabel = (
	room: MessageRoomTabLabelInput,
	duplicateTitles: ReadonlySet<string>,
): string => {
	const baseTitle = normalizeRoomTabTitle(room.title, room.chatId);
	if (!duplicateTitles.has(baseTitle)) {
		return baseTitle;
	}
	return `${baseTitle} · ${formatCompactRoomIdSuffix(room.chatId)}`;
};

export const resolveMessageRoomTabTitle = (room: MessageRoomTabLabelInput): string =>
	normalizeRoomTabTitle(room.title, room.chatId);
