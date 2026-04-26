import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import 'chat_surface_theme.dart';

class ChatReplyPreview extends StatelessWidget {
  const ChatReplyPreview({super.key, required this.message});

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
      margin: EdgeInsets.only(top: chatTokens(context).blockGap),
      padding: chatTokens(context).blockPadding,
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(chatTokens(context).blockRadius),
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
          SizedBox(height: chatTokens(context).inlineGap),
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

class ChatErrorMessageBlock extends StatelessWidget {
  const ChatErrorMessageBlock({super.key, required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final payload = message.payload;
    final errorColor = resolveChatColor(context, CupertinoColors.systemRed);
    return Container(
      width: double.infinity,
      margin: EdgeInsets.only(top: chatTokens(context).blockGap),
      padding: chatTokens(context).blockPadding,
      decoration: buildChatPanelDecoration(
        context,
        radius: chatTokens(context).blockRadius,
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

class ChatInteractiveMessageBlock extends StatefulWidget {
  const ChatInteractiveMessageBlock({
    super.key,
    required this.controller,
    required this.message,
  });

  final ChatViewController controller;
  final ChatMessage message;

  @override
  State<ChatInteractiveMessageBlock> createState() =>
      ChatInteractiveMessageBlockState();
}

class ChatInteractiveMessageBlockState
    extends State<ChatInteractiveMessageBlock> {
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
      padding: EdgeInsets.only(top: chatTokens(context).blockGap),
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
              padding: EdgeInsets.only(
                top: chatTokens(context).inlineGap,
                bottom: chatTokens(context).inlineGap,
              ),
              child: Text(
                interactive.description!,
                style: chatSecondaryTextStyle(context, fontSize: 14),
              ),
            )
          else
            SizedBox(height: chatTokens(context).inlineGap),
          ...interactive.fields.map((field) {
            final controller = _controllers.putIfAbsent(
              field.id,
              () => TextEditingController(text: field.initialValue ?? ''),
            );
            return Padding(
              padding: EdgeInsets.only(bottom: chatTokens(context).inlineGap),
              child: DecoratedBox(
                decoration: buildChatPanelDecoration(
                  context,
                  radius: chatTokens(context).blockRadius,
                ),
                child: CupertinoTextField(
                  controller: controller,
                  minLines: field.multiline ? 3 : 1,
                  maxLines: field.multiline ? 6 : 1,
                  placeholder: field.placeholder ?? field.label,
                  padding: chatTokens(context).blockPadding,
                  decoration: null,
                ),
              ),
            );
          }),
          CupertinoButton.filled(
            padding: chatTokens(context).blockPadding,
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
