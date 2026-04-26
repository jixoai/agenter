import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import 'chat_surface_theme.dart';

class ChatMessageMetaRow extends StatelessWidget {
  const ChatMessageMetaRow({
    super.key,
    required this.controller,
    required this.message,
    required this.viewerOwned,
    required this.onEdit,
  });

  final ChatViewController controller;
  final ChatMessage message;
  final bool viewerOwned;
  final VoidCallback onEdit;

  Future<void> _showMessageActions(BuildContext context) async {
    final l10n = ChatViewLocalizations.of(context);
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () async {
              Navigator.of(sheetContext).pop();
              await Clipboard.setData(ClipboardData(text: message.content));
            },
            child: Text(l10n.copyText),
          ),
          if (viewerOwned && !message.isRecalled && message.messageId != null)
            CupertinoActionSheetAction(
              onPressed: () {
                Navigator.of(sheetContext).pop();
                onEdit();
              },
              child: Text(l10n.editMessage),
            ),
          if (viewerOwned && !message.isRecalled && message.messageId != null)
            CupertinoActionSheetAction(
              isDestructiveAction: true,
              onPressed: () {
                final messageId = message.messageId;
                Navigator.of(sheetContext).pop();
                if (messageId != null) {
                  controller.recallMessage(messageId);
                }
              },
              child: Text(l10n.recallMessage),
            ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: Text(l10n.cancel),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final statusLabels = <String>[
      if (viewerOwned) l10n.you,
      if (message.isEdited) l10n.edited,
      if (message.isRecalled) l10n.recalled,
    ];
    final statusColor = viewerOwned
        ? CupertinoTheme.of(context).primaryColor
        : resolveChatColor(context, CupertinoColors.secondaryLabel);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    message.from.isEmpty
                        ? l10n.viewerFallbackName
                        : message.from,
                    style: chatTextStyle(
                      context,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (statusLabels.isNotEmpty)
                    Text(
                      statusLabels.join(' · '),
                      style: chatSecondaryTextStyle(
                        context,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ).copyWith(color: statusColor),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                formatChatTimestamp(context, message.createdAt),
                style: chatSecondaryTextStyle(
                  context,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        CupertinoButton(
          padding: EdgeInsets.zero,
          minimumSize: const Size(44, 44),
          alignment: Alignment.center,
          onPressed: () => _showMessageActions(context),
          child: const Icon(CupertinoIcons.ellipsis_circle),
        ),
      ],
    );
  }
}
