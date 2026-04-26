import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import '../model/chat_view_state.dart';
import 'chat_message_tile.dart';
import 'chat_stage_notices.dart';
import 'chat_surface_theme.dart';
import 'chat_transcript_entries.dart';

class ChatTranscriptViewport extends StatelessWidget {
  const ChatTranscriptViewport({
    super.key,
    required this.controller,
    required this.state,
    required this.scrollController,
    required this.editingMessageChanged,
    required this.compact,
    this.selectedMessageViewKey,
    this.onMessageSelected,
  });

  final ChatViewController controller;
  final ChatViewState state;
  final ScrollController scrollController;
  final ValueChanged<ChatMessage> editingMessageChanged;
  final bool compact;
  final String? selectedMessageViewKey;
  final ValueChanged<ChatMessage>? onMessageSelected;

  @override
  Widget build(BuildContext context) {
    final entries = buildChatTranscriptEntries(state);
    final referencedById = {
      for (final message in state.messages)
        if (message.messageId != null) message.messageId!: message,
    };
    return DecoratedBox(
      decoration: buildChatCanvasDecoration(context),
      child: state.loadingInitial && entries.isEmpty
          ? const Center(child: CupertinoActivityIndicator(radius: 14))
          : entries.isEmpty
          ? const ChatEmptyTranscriptState()
          : CupertinoScrollbar(
              controller: scrollController,
              thumbVisibility: !compact,
              child: ListView.builder(
                controller: scrollController,
                padding: chatTokens(context).transcriptPadding,
                itemCount: entries.length,
                itemBuilder: (context, index) {
                  final entry = entries[index];
                  return switch (entry) {
                    ChatLoadOlderEntry() => _LoadOlderTranscriptRow(
                      loading: state.loadingMore,
                      onPressed: controller.requestOlderPage,
                    ),
                    ChatTimeDividerEntry() => _TimeDividerTranscriptRow(
                      timestamp: entry.timestamp,
                    ),
                    ChatMessageEntry() => _MessageTranscriptRow(
                      controller: controller,
                      message: entry.message,
                      selected: entry.message.viewKey == selectedMessageViewKey,
                      viewerActorId: state.channel?.participantId,
                      referencedMessage: entry.message.ref == null
                          ? null
                          : referencedById[entry.message.ref!],
                      onMessageSelected: onMessageSelected,
                      onEdit: editingMessageChanged,
                    ),
                  };
                },
              ),
            ),
    );
  }
}

class _LoadOlderTranscriptRow extends StatelessWidget {
  const _LoadOlderTranscriptRow({
    required this.loading,
    required this.onPressed,
  });

  final bool loading;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return Center(
      child: CupertinoButton(
        onPressed: loading ? null : onPressed,
        child: loading
            ? const CupertinoActivityIndicator()
            : Text(l10n.loadOlderMessages),
      ),
    );
  }
}

class _TimeDividerTranscriptRow extends StatelessWidget {
  const _TimeDividerTranscriptRow({required this.timestamp});

  final int timestamp;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: chatTokens(context).timeDividerPadding,
        child: ChatMetaPill(label: formatChatDividerLabel(context, timestamp)),
      ),
    );
  }
}

class _MessageTranscriptRow extends StatelessWidget {
  const _MessageTranscriptRow({
    required this.controller,
    required this.message,
    required this.selected,
    required this.onEdit,
    this.viewerActorId,
    this.referencedMessage,
    this.onMessageSelected,
  });

  final ChatViewController controller;
  final ChatMessage message;
  final bool selected;
  final String? viewerActorId;
  final ChatMessage? referencedMessage;
  final ValueChanged<ChatMessage>? onMessageSelected;
  final ValueChanged<ChatMessage> onEdit;

  @override
  Widget build(BuildContext context) {
    return ChatMessageTile(
      controller: controller,
      message: message,
      selected: selected,
      onTap: onMessageSelected == null
          ? null
          : () => onMessageSelected!(message),
      viewerActorId: viewerActorId,
      referencedMessage: referencedMessage,
      onEdit: onEdit,
    );
  }
}
