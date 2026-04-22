import 'composer_plugin.dart';

class StaticSuggestionItem {
  const StaticSuggestionItem({
    required this.label,
    this.detail,
    this.insertText,
  });

  final String label;
  final String? detail;
  final String? insertText;
}

class StaticSuggestionPlugin extends ChatComposerPlugin {
  const StaticSuggestionPlugin({
    required this.id,
    required this.triggerCharacter,
    required this.items,
  });

  @override
  final String id;

  @override
  final String triggerCharacter;

  final List<StaticSuggestionItem> items;

  @override
  Future<List<ChatComposerSuggestion>> resolveSuggestions(
    ChatComposerRequest request,
  ) async {
    final query = request.token.query.trim().toLowerCase();
    final filtered = items.where((item) {
      if (query.isEmpty) {
        return true;
      }
      return item.label.toLowerCase().contains(query);
    });
    return filtered
        .map(
          (item) => ChatComposerSuggestion(
            label: item.label,
            detail: item.detail,
            insertText: item.insertText ?? item.label,
          ),
        )
        .toList(growable: false);
  }
}
