import type { MessageSystemRoomSeatState } from "./message-system-surface.types";

type MessageTranscriptSeatInput = Pick<
	MessageSystemRoomSeatState,
	"label" | "subtitle" | "role" | "currentAdmin"
>;

const resolveSeatDisambiguationFallback = (seat: MessageTranscriptSeatInput): string =>
	`${seat.role}${seat.currentAdmin ? " · current admin" : ""}`;

export const shouldShowSeatSubtitleForTranscript = (
	seat: Pick<MessageSystemRoomSeatState, "label">,
	duplicateSeatLabels: ReadonlySet<string>,
): boolean => duplicateSeatLabels.has(seat.label);

export const resolveSeatSubtitleForTranscript = (
	seat: MessageTranscriptSeatInput,
	duplicateSeatLabels: ReadonlySet<string>,
): string | undefined => {
	if (!shouldShowSeatSubtitleForTranscript(seat, duplicateSeatLabels)) {
		return undefined;
	}
	return seat.subtitle ?? resolveSeatDisambiguationFallback(seat);
};
