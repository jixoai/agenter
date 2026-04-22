import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:visibility_detector/visibility_detector.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import 'chat_markdown_view.dart';
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
          constraints: const BoxConstraints(maxWidth: 720),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Semantics(
              button: onTap != null,
              selected: selected,
              child: GestureDetector(
                onTap: onTap,
                child: DecoratedBox(
                  decoration: buildChatBubbleDecoration(
                    context,
                    viewerOwned: _viewerOwned,
                    selected: selected,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _MessageMetaRow(
                          controller: controller,
                          message: message,
                          viewerOwned: _viewerOwned,
                          onEdit: () => onEdit(message),
                        ),
                        if (referencedMessage != null)
                          _ReplyPreview(message: referencedMessage!),
                        if (message.kind == ChatMessageKind.error &&
                            message.payload != null)
                          _ErrorBlock(message: message)
                        else if (message.isInteractive)
                          _InteractiveBlock(
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
                          _AttachmentStrip(attachments: message.attachments),
                        if (message.readActorIds.isNotEmpty ||
                            message.unreadActorIds.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  CupertinoIcons.eye,
                                  size: 12,
                                  color: resolveChatColor(
                                    context,
                                    CupertinoColors.secondaryLabel,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  ChatViewLocalizations.of(context).readCount(
                                    message.readActorIds.length,
                                    message.readActorIds.length +
                                        message.unreadActorIds.length,
                                  ),
                                  style: chatSecondaryTextStyle(
                                    context,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
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

class _MessageMetaRow extends StatelessWidget {
  const _MessageMetaRow({
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

class _ReplyPreview extends StatelessWidget {
  const _ReplyPreview({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final preview =
        (message.isRecalled ? l10n.recalledMessageText : message.displayText)
            .replaceAll(RegExp(r'\s+'), ' ')
            .trim();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message.from,
            style: chatSecondaryTextStyle(
              context,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            preview.isEmpty ? l10n.emptyMessagePreview : preview,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: chatTextStyle(context, fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _AttachmentStrip extends StatelessWidget {
  const _AttachmentStrip({required this.attachments});

  final List<ChatAttachment> attachments;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: attachments
            .map(
              (attachment) => attachment.kind == ChatAttachmentKind.image
                  ? _ImageAttachmentCard(attachment: attachment)
                  : _FileAttachmentPill(attachment: attachment),
            )
            .toList(growable: false),
      ),
    );
  }
}

class _ImageAttachmentCard extends StatelessWidget {
  const _ImageAttachmentCard({required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 152,
      decoration: buildChatPanelDecoration(context, radius: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: SizedBox(
              height: 104,
              width: double.infinity,
              child: Image.network(
                attachment.url,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => ColoredBox(
                  color: resolveChatColor(
                    context,
                    CupertinoColors.tertiarySystemGroupedBackground,
                  ),
                  child: const Center(
                    child: Icon(CupertinoIcons.photo_fill_on_rectangle_fill),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Text(
              attachment.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: chatTextStyle(context, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _FileAttachmentPill extends StatelessWidget {
  const _FileAttachmentPill({required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final icon = switch (attachment.kind) {
      ChatAttachmentKind.image => CupertinoIcons.photo,
      ChatAttachmentKind.video => CupertinoIcons.video_camera,
      ChatAttachmentKind.file => CupertinoIcons.doc,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14),
            const SizedBox(width: 6),
            Text(
              attachment.name,
              style: chatSecondaryTextStyle(
                context,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBlock extends StatelessWidget {
  const _ErrorBlock({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final payload = message.payload;
    final errorColor = resolveChatColor(context, CupertinoColors.systemRed);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: buildChatPanelDecoration(
        context,
        radius: 16,
        fillColor: errorColor.withValues(alpha: 0.1),
        borderColor: errorColor.withValues(alpha: 0.18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            payload?.errorTitle ?? l10n.defaultErrorTitle,
            style: chatTextStyle(
              context,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (payload?.errorCode != null)
            Text(payload!.errorCode!, style: chatSecondaryTextStyle(context)),
          if (payload?.errorDetail != null)
            Text(payload!.errorDetail!, style: chatSecondaryTextStyle(context)),
        ],
      ),
    );
  }
}

class _InteractiveBlock extends StatefulWidget {
  const _InteractiveBlock({required this.controller, required this.message});

  final ChatViewController controller;
  final ChatMessage message;

  @override
  State<_InteractiveBlock> createState() => _InteractiveBlockState();
}

class _InteractiveBlockState extends State<_InteractiveBlock> {
  final Map<String, TextEditingController> _controllers =
      <String, TextEditingController>{};

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final interactive = widget.message.payload?.interactive;
    if (interactive == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            interactive.title.trim().isEmpty
                ? l10n.interactiveFallbackTitle
                : interactive.title,
            style: chatTextStyle(
              context,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (interactive.description != null)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 8),
              child: Text(
                interactive.description!,
                style: chatSecondaryTextStyle(context, fontSize: 14),
              ),
            )
          else
            const SizedBox(height: 8),
          ...interactive.fields.map((field) {
            final controller = _controllers.putIfAbsent(
              field.id,
              () => TextEditingController(text: field.initialValue ?? ''),
            );
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: DecoratedBox(
                decoration: buildChatPanelDecoration(context, radius: 16),
                child: CupertinoTextField(
                  controller: controller,
                  minLines: field.multiline ? 3 : 1,
                  maxLines: field.multiline ? 6 : 1,
                  placeholder: field.placeholder ?? field.label,
                  padding: const EdgeInsets.all(12),
                  decoration: null,
                ),
              ),
            );
          }),
          CupertinoButton.filled(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            onPressed: () async {
              final buffer = StringBuffer(
                widget.message.isRecalled
                    ? l10n.recalledMessageText
                    : widget.message.content,
              );
              for (final field in interactive.fields) {
                final value = _controllers[field.id]?.text.trim() ?? '';
                if (value.isEmpty) {
                  continue;
                }
                buffer.write('\n${field.label}: $value');
              }
              await widget.controller.sendText(buffer.toString());
            },
            child: Text(interactive.submitLabel ?? l10n.interactiveSubmit),
          ),
        ],
      ),
    );
  }
}
