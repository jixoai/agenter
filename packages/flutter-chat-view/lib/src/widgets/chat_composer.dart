import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import '../plugin/composer_plugin.dart';
import 'chat_surface_theme.dart';

class ChatComposer extends StatefulWidget {
  const ChatComposer({
    required this.controller,
    required this.plugins,
    required this.editingMessage,
    required this.onEditingMessageChanged,
    this.compactLayout = false,
    super.key,
  });

  final ChatViewController controller;
  final List<ChatComposerPlugin> plugins;
  final ChatMessage? editingMessage;
  final ValueChanged<ChatMessage?> onEditingMessageChanged;
  final bool compactLayout;

  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final TextEditingController _textController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  List<XFile> _pendingFiles = <XFile>[];
  List<ChatComposerSuggestion> _suggestions = <ChatComposerSuggestion>[];
  ComposerToken? _activeToken;
  int _suggestionRequestId = 0;

  @override
  void initState() {
    super.initState();
    _textController.addListener(_handleDraftChanged);
  }

  @override
  void didUpdateWidget(covariant ChatComposer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.editingMessage?.messageId !=
        oldWidget.editingMessage?.messageId) {
      _textController.text = widget.editingMessage?.content ?? '';
    }
  }

  @override
  void dispose() {
    _textController.removeListener(_handleDraftChanged);
    _textController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleDraftChanged() {
    if (mounted) {
      setState(() {});
    }
    _refreshSuggestions();
  }

  Future<void> _refreshSuggestions() async {
    final cursor = _textController.selection.baseOffset;
    final token = findComposerToken(
      value: _textController.text,
      cursor: cursor < 0 ? _textController.text.length : cursor,
      triggers: widget.plugins.map((plugin) => plugin.triggerCharacter).toSet(),
    );
    if (token == null) {
      if (mounted) {
        setState(() {
          _activeToken = null;
          _suggestions = <ChatComposerSuggestion>[];
        });
      }
      return;
    }
    ChatComposerPlugin? plugin;
    for (final entry in widget.plugins) {
      if (entry.triggerCharacter == token.trigger) {
        plugin = entry;
        break;
      }
    }
    if (plugin == null) {
      return;
    }
    final requestId = ++_suggestionRequestId;
    final suggestions = await plugin.resolveSuggestions(
      ChatComposerRequest(controller: widget.controller, token: token),
    );
    if (!mounted || requestId != _suggestionRequestId) {
      return;
    }
    setState(() {
      _activeToken = token;
      _suggestions = suggestions.take(8).toList(growable: false);
    });
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.pickFiles(allowMultiple: true);
    if (result == null) {
      return;
    }
    setState(() {
      _pendingFiles = [..._pendingFiles, ...result.xFiles];
    });
  }

  Future<void> _send() async {
    final draft = _textController.text.trim();
    if (draft == '/screenshot' &&
        widget.controller.screenshotCapture != null &&
        _pendingFiles.isEmpty) {
      final captured = await widget.controller.screenshotCapture!.call();
      setState(() {
        _pendingFiles = [..._pendingFiles, captured];
        _textController.clear();
      });
      return;
    }
    if (widget.editingMessage?.messageId case final messageId?) {
      await widget.controller.editMessage(messageId: messageId, text: draft);
      widget.onEditingMessageChanged(null);
      _textController.clear();
      return;
    }
    await widget.controller.sendText(draft, attachments: _pendingFiles);
    if (!mounted) {
      return;
    }
    setState(() {
      _pendingFiles = <XFile>[];
      _suggestions = <ChatComposerSuggestion>[];
      _activeToken = null;
      _textController.clear();
    });
  }

  void _cancelEditing() {
    widget.onEditingMessageChanged(null);
    _textController.clear();
    _focusNode.unfocus();
  }

  void _applySuggestion(ChatComposerSuggestion suggestion) {
    final token = _activeToken;
    if (token == null) {
      return;
    }
    final text = _textController.text;
    final nextText =
        '${text.substring(0, token.from)}${suggestion.insertText} ${text.substring(token.to)}';
    _textController.value = TextEditingValue(
      text: nextText,
      selection: TextSelection.collapsed(
        offset: token.from + suggestion.insertText.length + 1,
      ),
    );
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final sending = widget.controller.state.sending;
    final editing = widget.editingMessage != null;
    final draft = _textController.text.trim();
    final canSubmit =
        !sending &&
        (editing ||
            draft.isNotEmpty ||
            _pendingFiles.isNotEmpty ||
            (draft == '/screenshot' &&
                widget.controller.screenshotCapture != null));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_suggestions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: CupertinoListSection.insetGrouped(
              margin: EdgeInsets.zero,
              backgroundColor: CupertinoColors.transparent,
              children: _suggestions
                  .map(
                    (suggestion) => CupertinoListTile.notched(
                      title: Text(suggestion.label),
                      subtitle: suggestion.detail == null
                          ? null
                          : Text(suggestion.detail!),
                      onTap: () => _applySuggestion(suggestion),
                    ),
                  )
                  .toList(growable: false),
            ),
          ),
        if (_pendingFiles.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _pendingFiles
                  .map(
                    (file) => _PendingFilePill(
                      file: file,
                      onDelete: () {
                        setState(() {
                          _pendingFiles = _pendingFiles
                              .where((entry) => entry != file)
                              .toList(growable: false);
                        });
                      },
                    ),
                  )
                  .toList(growable: false),
            ),
          ),
        DecoratedBox(
          decoration: buildChatPanelDecoration(context, radius: 28),
          child: LayoutBuilder(
            builder: (context, constraints) {
              const actionWidth = 48.0;
              const leadingGap = 6.0;
              const trailingGap = 8.0;
              final stackedSendAction = constraints.maxWidth < 348;
              final leadingAction = SizedBox.square(
                dimension: actionWidth,
                child: editing
                    ? Semantics(
                        button: true,
                        label: l10n.cancel,
                        child: CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(48, 48),
                          alignment: Alignment.center,
                          onPressed: _cancelEditing,
                          child: Icon(
                            CupertinoIcons.clear_circled_solid,
                            color: resolveChatColor(
                              context,
                              CupertinoColors.secondaryLabel,
                            ),
                            size: 22,
                          ),
                        ),
                      )
                    : Semantics(
                        button: true,
                        label: l10n.attachFiles,
                        child: CupertinoButton(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(48, 48),
                          alignment: Alignment.center,
                          onPressed: widget.controller.supportsAttachments
                              ? _pickFiles
                              : null,
                          child: Icon(
                            CupertinoIcons.paperclip,
                            color: CupertinoTheme.of(context).primaryColor,
                            size: 22,
                          ),
                        ),
                      ),
              );
              final messageField = CupertinoTextField.borderless(
                controller: _textController,
                focusNode: _focusNode,
                minLines: 1,
                maxLines: 6,
                placeholder: l10n.composerHint(editing: editing),
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 12,
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: canSubmit ? (_) => _send() : null,
              );
              final sendAction = SizedBox.square(
                dimension: actionWidth,
                child: Semantics(
                  button: true,
                  enabled: canSubmit,
                  label: l10n.actionLabel(editing: editing),
                  child: IgnorePointer(
                    ignoring: !canSubmit,
                    child: CupertinoButton(
                      padding: EdgeInsets.zero,
                      color: canSubmit
                          ? CupertinoTheme.of(context).primaryColor
                          : resolveChatColor(
                              context,
                              CupertinoColors.systemGrey3,
                            ),
                      borderRadius: BorderRadius.circular(999),
                      minimumSize: const Size(48, 48),
                      alignment: Alignment.center,
                      onPressed: _send,
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
              );
              return Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: stackedSendAction
                    ? Stack(
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 56),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                leadingAction,
                                const SizedBox(width: leadingGap),
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
                          const SizedBox(width: leadingGap),
                          Expanded(child: messageField),
                          const SizedBox(width: trailingGap),
                          sendAction,
                        ],
                      ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _PendingFilePill extends StatelessWidget {
  const _PendingFilePill({required this.file, required this.onDelete});

  final XFile file;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.only(left: 12, right: 4, top: 6, bottom: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              CupertinoIcons.doc,
              size: 14,
              color: resolveChatColor(context, CupertinoColors.secondaryLabel),
            ),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 180),
              child: Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: chatSecondaryTextStyle(
                  context,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            CupertinoButton(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              minimumSize: Size.zero,
              onPressed: onDelete,
              child: const Icon(CupertinoIcons.clear_circled_solid, size: 18),
            ),
          ],
        ),
      ),
    );
  }
}
