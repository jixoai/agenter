import 'package:characters/characters.dart';

import '../controller/chat_view_controller.dart';

class ComposerToken {
  const ComposerToken({
    required this.trigger,
    required this.from,
    required this.to,
    required this.query,
    required this.raw,
  });

  final String trigger;
  final int from;
  final int to;
  final String query;
  final String raw;
}

class ChatComposerSuggestion {
  const ChatComposerSuggestion({
    required this.label,
    required this.insertText,
    this.detail,
  });

  final String label;
  final String insertText;
  final String? detail;
}

class ChatComposerRequest {
  const ChatComposerRequest({required this.controller, required this.token});

  final ChatViewController controller;
  final ComposerToken token;
}

abstract class ChatComposerPlugin {
  const ChatComposerPlugin();

  String get id;
  String get triggerCharacter;

  Future<List<ChatComposerSuggestion>> resolveSuggestions(
    ChatComposerRequest request,
  );
}

bool _isTokenBoundary(String char) {
  return RegExp(r'\s|[(){}\[\],;:"`]').hasMatch(char) || char == "'";
}

ComposerToken? findComposerToken({
  required String value,
  required int cursor,
  required Set<String> triggers,
}) {
  final safeCursor = cursor.clamp(0, value.length);
  var start = safeCursor;
  while (start > 0) {
    final previous = value[start - 1];
    if (_isTokenBoundary(previous)) {
      break;
    }
    start -= 1;
  }
  final raw = value.substring(start, safeCursor);
  if (raw.isEmpty) {
    return null;
  }
  final trigger = raw.characters.first;
  if (!triggers.contains(trigger)) {
    return null;
  }
  return ComposerToken(
    trigger: trigger,
    from: start,
    to: safeCursor,
    query: raw.substring(trigger.length),
    raw: raw,
  );
}
