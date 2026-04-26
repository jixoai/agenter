import 'package:flutter/cupertino.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import 'chat_markdown_view.dart';
import 'chat_message_parts.dart';
import 'chat_surface_theme.dart';

class ChatMessageTile extends StatelessWidget {
  const ChatMessageTile({
    required this.controller,
    required this.message,
    required this.selected,
    this.onTap,
    required this.viewerActorId,
    required this.referencedMessage,
    required this.onEdit,
    super.key,
  });

  final ChatViewController controller;
  final ChatMessage message;
  final bool selected;
  final VoidCallback? onTap;
  final String? viewerActorId;
  final ChatMessage? referencedMessage;
  final ValueChanged<ChatMessage> onEdit;

  bool get _viewerOwned =>
      viewerActorId != null && message.senderActorId == viewerActorId;

  @override
  Widget build(BuildContext context) {
    return VisibilityDetector(
      key: ValueKey<String>('message-${message.viewKey}'),
      onVisibilityChanged: (info) =>
          controller.setMessageVisibility(message, info.visibleFraction),
      child: Align(
        alignment: _viewerOwned ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: chatTokens(context).messageMaxWidth,
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              vertical: chatTokens(context).messageVerticalGap,
            ),
            child: Semantics(
              button: onTap != null,
              selected: selected,
              onTap: onTap,
              child: GestureDetector(
                excludeFromSemantics: true,
                onTap: onTap,
                child: DecoratedBox(
                  decoration: buildChatBubbleDecoration(
                    context,
                    viewerOwned: _viewerOwned,
                    selected: selected,
                  ),
                  child: Padding(
                    padding: chatTokens(context).messagePadding,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ChatMessageMetaRow(
                          controller: controller,
                          message: message,
                          viewerOwned: _viewerOwned,
                          onEdit: () => onEdit(message),
                        ),
                        if (referencedMessage != null)
                          ChatReplyPreview(message: referencedMessage!),
                        if (message.kind == ChatMessageKind.error &&
                            message.payload != null)
                          ChatErrorMessageBlock(message: message)
                        else if (message.isInteractive)
                          ChatInteractiveMessageBlock(
                            controller: controller,
                            message: message,
                          )
                        else
                          ChatMarkdownView(
                            markdown: message.isRecalled
                                ? ChatViewLocalizations.of(
                                    context,
                                  ).recalledMessageText
                                : message.displayText,
                          ),
                        if (message.attachments.isNotEmpty)
                          ChatAttachmentStrip(attachments: message.attachments),
                        if (message.readActorIds.isNotEmpty ||
                            message.unreadActorIds.isNotEmpty)
                          ChatReadReceiptSummary(message: message),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ChatReadReceiptSummary extends StatelessWidget {
  const ChatReadReceiptSummary({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: chatTokens(context).blockGap),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            CupertinoIcons.eye,
            size: 12,
            color: resolveChatColor(context, CupertinoColors.secondaryLabel),
          ),
          SizedBox(width: chatTokens(context).inlineGap),
          Text(
            ChatViewLocalizations.of(context).readCount(
              message.readActorIds.length,
              message.readActorIds.length + message.unreadActorIds.length,
            ),
            style: chatSecondaryTextStyle(
              context,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
