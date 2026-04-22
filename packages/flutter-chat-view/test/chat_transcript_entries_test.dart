import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/model/chat_models.dart';
import 'package:flutter_chat_view/src/model/chat_view_state.dart';
import 'package:flutter_chat_view/src/widgets/chat_transcript_entries.dart';

void main() {
  group('Feature: transcript entry projection', () {
    test(
      'Scenario: Given long-gap room messages When building transcript entries Then restrained time dividers and older-page entry are projected',
      () {
        final state = ChatViewState(
          connectionState: ChatViewConnectionState.connected,
          hasMoreBefore: true,
          messages: [
            _message(viewKey: 'm1', rowId: 1, createdAt: 100),
            _message(
              viewKey: 'm2',
              rowId: 2,
              createdAt: const Duration(minutes: 45).inMilliseconds,
            ),
          ],
        );

        final entries = buildChatTranscriptEntries(state);

        expect(entries.first, isA<ChatLoadOlderEntry>());
        expect(entries.whereType<ChatTimeDividerEntry>().length, 2);
        expect(entries.whereType<ChatMessageEntry>().length, 2);
      },
    );

    test(
      'Scenario: Given nearby room messages When building transcript entries Then only the opening divider is emitted',
      () {
        final state = ChatViewState(
          connectionState: ChatViewConnectionState.connected,
          messages: [
            _message(viewKey: 'm1', rowId: 1, createdAt: 100),
            _message(
              viewKey: 'm2',
              rowId: 2,
              createdAt: const Duration(minutes: 5).inMilliseconds,
            ),
          ],
        );

        final entries = buildChatTranscriptEntries(state);

        expect(entries.whereType<ChatTimeDividerEntry>().length, 1);
      },
    );
  });
}

ChatMessage _message({
  required String viewKey,
  required int rowId,
  required int createdAt,
}) {
  return ChatMessage(
    viewKey: viewKey,
    rowId: rowId,
    chatId: 'room-demo',
    from: 'Tester',
    kind: ChatMessageKind.text,
    content: 'hello',
    createdAt: createdAt,
    updatedAt: createdAt,
    readActorIds: const <String>[],
    unreadActorIds: const <String>[],
  );
}
