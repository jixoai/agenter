import '../model/chat_models.dart';
import '../model/chat_view_state.dart';

sealed class ChatTranscriptEntry {
  const ChatTranscriptEntry();
}

class ChatLoadOlderEntry extends ChatTranscriptEntry {
  const ChatLoadOlderEntry();
}

class ChatTimeDividerEntry extends ChatTranscriptEntry {
  const ChatTimeDividerEntry({required this.timestamp});

  final int timestamp;
}

class ChatMessageEntry extends ChatTranscriptEntry {
  const ChatMessageEntry({required this.message});

  final ChatMessage message;
}

List<ChatTranscriptEntry> buildChatTranscriptEntries(ChatViewState state) {
  final entries = <ChatTranscriptEntry>[];
  if (state.hasMoreBefore) {
    entries.add(const ChatLoadOlderEntry());
  }
  ChatMessage? previousMessage;
  for (final message in state.messages) {
    if (_shouldInsertTimeDivider(previousMessage, message)) {
      entries.add(ChatTimeDividerEntry(timestamp: message.createdAt));
    }
    entries.add(ChatMessageEntry(message: message));
    previousMessage = message;
  }
  return entries;
}

bool _shouldInsertTimeDivider(ChatMessage? previous, ChatMessage current) {
  if (previous == null) {
    return true;
  }
  final previousTime = DateTime.fromMillisecondsSinceEpoch(previous.createdAt);
  final currentTime = DateTime.fromMillisecondsSinceEpoch(current.createdAt);
  final dateBoundary =
      previousTime.year != currentTime.year ||
      previousTime.month != currentTime.month ||
      previousTime.day != currentTime.day;
  if (dateBoundary) {
    return true;
  }
  return current.createdAt - previous.createdAt >=
      const Duration(minutes: 30).inMilliseconds;
}
