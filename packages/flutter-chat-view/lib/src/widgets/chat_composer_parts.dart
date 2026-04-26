import 'dart:async';

import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../plugin/composer_plugin.dart';
import 'chat_surface_theme.dart';

class ChatComposerSuggestionList extends StatelessWidget {
  const ChatComposerSuggestionList({
    super.key,
    required this.suggestions,
    required this.onSuggestionSelected,
  });

  final List<ChatComposerSuggestion> suggestions;
  final ValueChanged<ChatComposerSuggestion> onSuggestionSelected;

  @override
  Widget build(BuildContext context) {
    if (suggestions.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: EdgeInsets.only(bottom: chatTokens(context).inlineGap),
      child: CupertinoListSection.insetGrouped(
        margin: EdgeInsets.zero,
        backgroundColor: CupertinoColors.transparent,
        children: suggestions
            .map(
              (suggestion) => CupertinoListTile.notched(
                title: Text(suggestion.label),
                subtitle: suggestion.detail == null
                    ? null
                    : Text(suggestion.detail!),
                onTap: () => onSuggestionSelected(suggestion),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

class ChatComposerInputBar extends StatelessWidget {
  const ChatComposerInputBar({
    super.key,
    required this.controller,
    required this.textController,
    required this.focusNode,
    required this.editing,
    required this.canSubmit,
    required this.onCancelEditing,
    required this.onPickFiles,
    required this.onSend,
  });

  final ChatViewController controller;
  final TextEditingController textController;
  final FocusNode focusNode;
  final bool editing;
  final bool canSubmit;
  final VoidCallback onCancelEditing;
  final Future<void> Function() onPickFiles;
  final Future<void> Function() onSend;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return DecoratedBox(
      decoration: buildChatPanelDecoration(context),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final leadingGap = chatTokens(context).inlineGap;
          final trailingGap = chatTokens(context).inlineGap;
          final stackedSendAction = constraints.maxWidth < 348;
          final leadingAction = ChatComposerLeadingAction(
            editing: editing,
            supportsAttachments: controller.supportsAttachments,
            onCancelEditing: onCancelEditing,
            onPickFiles: onPickFiles,
          );
          final messageField = CupertinoTextField.borderless(
            controller: textController,
            focusNode: focusNode,
            minLines: 1,
            maxLines: 6,
            placeholder: l10n.composerHint(editing: editing),
            padding: chatTokens(context).composerFieldPadding,
            textInputAction: TextInputAction.send,
            onSubmitted: canSubmit ? (_) => onSend() : null,
          );
          final sendAction = ChatComposerSendAction(
            editing: editing,
            canSubmit: canSubmit,
            onSend: onSend,
          );
          return Padding(
            padding: chatTokens(context).composerBarPadding,
            child: stackedSendAction
                ? Stack(
                    children: [
                      Padding(
                        padding: EdgeInsets.only(
                          bottom: chatTokens(context).composerActionSize + 8,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            leadingAction,
                            SizedBox(width: leadingGap),
                            Expanded(child: messageField),
                          ],
                        ),
                      ),
                      Positioned(right: 0, bottom: 0, child: sendAction),
                    ],
                  )
                : Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      leadingAction,
                      SizedBox(width: leadingGap),
                      Expanded(child: messageField),
                      SizedBox(width: trailingGap),
                      sendAction,
                    ],
                  ),
          );
        },
      ),
    );
  }
}

class ChatComposerLeadingAction extends StatelessWidget {
  const ChatComposerLeadingAction({
    super.key,
    required this.editing,
    required this.supportsAttachments,
    required this.onCancelEditing,
    required this.onPickFiles,
  });

  final bool editing;
  final bool supportsAttachments;
  final VoidCallback onCancelEditing;
  final Future<void> Function() onPickFiles;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return SizedBox.square(
      dimension: chatTokens(context).composerActionSize,
      child: editing
          ? Semantics(
              container: true,
              button: true,
              label: l10n.cancel,
              onTap: onCancelEditing,
              child: ExcludeSemantics(
                child: CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.square(
                    chatTokens(context).composerActionSize,
                  ),
                  alignment: Alignment.center,
                  onPressed: onCancelEditing,
                  child: Icon(
                    CupertinoIcons.clear_circled_solid,
                    color: resolveChatColor(
                      context,
                      CupertinoColors.secondaryLabel,
                    ),
                    size: 22,
                  ),
                ),
              ),
            )
          : Semantics(
              container: true,
              button: true,
              enabled: supportsAttachments,
              label: l10n.attachFiles,
              onTap: supportsAttachments
                  ? () => unawaited(onPickFiles())
                  : null,
              child: ExcludeSemantics(
                child: CupertinoButton(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.square(
                    chatTokens(context).composerActionSize,
                  ),
                  alignment: Alignment.center,
                  onPressed: supportsAttachments ? onPickFiles : null,
                  child: Icon(
                    CupertinoIcons.paperclip,
                    color: CupertinoTheme.of(context).primaryColor,
                    size: 22,
                  ),
                ),
              ),
            ),
    );
  }
}

class ChatComposerSendAction extends StatelessWidget {
  const ChatComposerSendAction({
    super.key,
    required this.editing,
    required this.canSubmit,
    required this.onSend,
  });

  final bool editing;
  final bool canSubmit;
  final Future<void> Function() onSend;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return SizedBox.square(
      dimension: chatTokens(context).composerActionSize,
      child: Semantics(
        container: true,
        button: true,
        enabled: canSubmit,
        label: l10n.actionLabel(editing: editing),
        onTap: canSubmit ? () => unawaited(onSend()) : null,
        child: ExcludeSemantics(
          child: IgnorePointer(
            ignoring: !canSubmit,
            child: CupertinoButton(
              padding: EdgeInsets.zero,
              color: canSubmit
                  ? CupertinoTheme.of(context).primaryColor
                  : resolveChatColor(context, CupertinoColors.systemGrey3),
              borderRadius: BorderRadius.circular(
                chatTokens(context).controlRadius,
              ),
              minimumSize: Size.square(chatTokens(context).composerActionSize),
              alignment: Alignment.center,
              onPressed: onSend,
              child: Icon(
                editing
                    ? CupertinoIcons.check_mark_circled_solid
                    : CupertinoIcons.arrow_up_circle_fill,
                size: 18,
                color: CupertinoColors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
