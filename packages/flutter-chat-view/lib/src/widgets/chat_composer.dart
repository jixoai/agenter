import 'package:cross_file/cross_file.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../model/chat_models.dart';
import '../plugin/composer_plugin.dart';
import 'chat_composer_attachment_tray.dart';
import 'chat_composer_parts.dart';

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
      _clearSuggestions();
      return;
    }
    final plugin = widget.plugins.cast<ChatComposerPlugin?>().firstWhere(
      (entry) => entry?.triggerCharacter == token.trigger,
      orElse: () => null,
    );
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

  void _clearSuggestions() {
    if (!mounted) {
      return;
    }
    setState(() {
      _activeToken = null;
      _suggestions = <ChatComposerSuggestion>[];
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

  void _removePendingFile(XFile file) {
    setState(() {
      _pendingFiles = _pendingFiles
          .where((entry) => entry != file)
          .toList(growable: false);
    });
  }

  @override
  Widget build(BuildContext context) {
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
        ChatComposerSuggestionList(
          suggestions: _suggestions,
          onSuggestionSelected: _applySuggestion,
        ),
        ChatPendingAttachmentTray(
          files: _pendingFiles,
          onDelete: _removePendingFile,
        ),
        ChatComposerInputBar(
          controller: widget.controller,
          textController: _textController,
          focusNode: _focusNode,
          editing: editing,
          canSubmit: canSubmit,
          onCancelEditing: _cancelEditing,
          onPickFiles: _pickFiles,
          onSend: _send,
        ),
      ],
    );
  }
}
