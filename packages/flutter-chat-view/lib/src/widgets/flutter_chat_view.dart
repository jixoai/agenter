import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import '../plugin/composer_plugin.dart';
import 'chat_composer.dart';
import 'chat_message_tile.dart';
import 'chat_surface_theme.dart';
import 'chat_transcript_entries.dart';

class FlutterChatView extends StatefulWidget {
  const FlutterChatView({
    required this.controller,
    this.plugins = const <ChatComposerPlugin>[],
    this.selectedMessageViewKey,
    this.onMessageSelected,
    this.compactComposerLayout = false,
    super.key,
  });

  final ChatViewController controller;
  final List<ChatComposerPlugin> plugins;
  final String? selectedMessageViewKey;
  final ValueChanged<ChatMessage>? onMessageSelected;
  final bool compactComposerLayout;

  @override
  State<FlutterChatView> createState() => _FlutterChatViewState();
}

class _FlutterChatViewState extends State<FlutterChatView> {
  final ScrollController _scrollController = ScrollController();
  ChatMessage? _editingMessage;
  bool _showReturnToLatest = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_handleControllerChanged);
    _scrollController.addListener(_handleScrollChanged);
  }

  @override
  void didUpdateWidget(covariant FlutterChatView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_handleControllerChanged);
      widget.controller.addListener(_handleControllerChanged);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_handleControllerChanged);
    _scrollController.removeListener(_handleScrollChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleControllerChanged() {
    if (!_scrollController.hasClients) {
      return;
    }
    final distanceToBottom =
        _scrollController.position.maxScrollExtent - _scrollController.offset;
    if (distanceToBottom < 120) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!_scrollController.hasClients) {
          return;
        }
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      });
    }
  }

  void _handleScrollChanged() {
    if (!_scrollController.hasClients) {
      return;
    }
    final distanceToBottom =
        _scrollController.position.maxScrollExtent - _scrollController.offset;
    final nextShow = distanceToBottom > 240;
    if (nextShow != _showReturnToLatest) {
      setState(() {
        _showReturnToLatest = nextShow;
      });
    }
  }

  Future<void> _jumpToLatest() async {
    if (!_scrollController.hasClients) {
      return;
    }
    await _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, child) {
        final l10n = ChatViewLocalizations.of(context);
        final state = widget.controller.state;
        final compact = MediaQuery.sizeOf(context).width < 720;
        final entries = buildChatTranscriptEntries(state);
        final referencedById = {
          for (final message in state.messages)
            if (message.messageId != null) message.messageId!: message,
        };
        return Stack(
          children: [
            Column(
              children: [
                if (state.errorMessage case final errorMessage?)
                  Padding(
                    padding: EdgeInsets.fromLTRB(12, compact ? 8 : 12, 12, 0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: compact ? double.infinity : 720,
                        ),
                        child: _ErrorBanner(
                          message: errorMessage,
                          onRetry: widget.controller.connect,
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: DecoratedBox(
                    decoration: buildChatCanvasDecoration(context),
                    child: state.loadingInitial && entries.isEmpty
                        ? const Center(
                            child: CupertinoActivityIndicator(radius: 14),
                          )
                        : entries.isEmpty
                        ? const _EmptyTranscriptState()
                        : CupertinoScrollbar(
                            controller: _scrollController,
                            thumbVisibility: !compact,
                            child: ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.all(16),
                              itemCount: entries.length,
                              itemBuilder: (context, index) {
                                final entry = entries[index];
                                switch (entry) {
                                  case ChatLoadOlderEntry():
                                    return Center(
                                      child: CupertinoButton(
                                        onPressed: state.loadingMore
                                            ? null
                                            : widget
                                                  .controller
                                                  .requestOlderPage,
                                        child: state.loadingMore
                                            ? const CupertinoActivityIndicator()
                                            : Text(l10n.loadOlderMessages),
                                      ),
                                    );
                                  case ChatTimeDividerEntry():
                                    return Center(
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                        child: ChatMetaPill(
                                          label: formatChatDividerLabel(
                                            context,
                                            entry.timestamp,
                                          ),
                                        ),
                                      ),
                                    );
                                  case ChatMessageEntry():
                                    final message = entry.message;
                                    final referencedMessage =
                                        message.ref == null
                                        ? null
                                        : referencedById[message.ref!];
                                    return ChatMessageTile(
                                      controller: widget.controller,
                                      message: message,
                                      selected:
                                          message.viewKey ==
                                          widget.selectedMessageViewKey,
                                      onTap: widget.onMessageSelected == null
                                          ? null
                                          : () => widget.onMessageSelected!(
                                              message,
                                            ),
                                      viewerActorId:
                                          state.channel?.participantId,
                                      referencedMessage: referencedMessage,
                                      onEdit: (value) => setState(
                                        () => _editingMessage = value,
                                      ),
                                    );
                                }
                              },
                            ),
                          ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    12,
                    compact ? 8 : 10,
                    12,
                    compact ? 10 : 12,
                  ),
                  child: ChatComposer(
                    controller: widget.controller,
                    plugins: widget.plugins,
                    editingMessage: _editingMessage,
                    compactLayout: widget.compactComposerLayout,
                    onEditingMessageChanged: (value) =>
                        setState(() => _editingMessage = value),
                  ),
                ),
              ],
            ),
            if (_showReturnToLatest)
              Positioned(
                right: 20,
                bottom: compact ? 96 : 112,
                child: CupertinoButton.filled(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  onPressed: _jumpToLatest,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.arrow_down),
                      const SizedBox(width: 8),
                      Text(l10n.latest),
                    ],
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    final errorColor = resolveChatColor(context, CupertinoColors.systemRed);
    final presented = _presentErrorMessage(context, message);
    final compact = MediaQuery.sizeOf(context).width < 720;
    final retryLabel = Text(
      l10n.retry,
      style: chatTextStyle(
        context,
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: CupertinoTheme.of(context).primaryColor,
      ),
    );
    final retryButton = CupertinoButton(
      padding: compact
          ? const EdgeInsets.symmetric(horizontal: 10, vertical: 8)
          : EdgeInsets.zero,
      minimumSize: Size(compact ? 44 : 44, compact ? 36 : 44),
      alignment: Alignment.center,
      onPressed: onRetry,
      child: compact ? retryLabel : retryLabel,
    );
    return DecoratedBox(
      decoration: buildChatPanelDecoration(
        context,
        radius: 20,
        fillColor: errorColor.withValues(alpha: 0.1),
        borderColor: errorColor.withValues(alpha: 0.18),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          compact ? 12 : 14,
          compact ? 10 : 12,
          compact ? 12 : 14,
          compact ? 10 : 12,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(
                CupertinoIcons.exclamationmark_triangle,
                color: errorColor,
                size: compact ? 18 : 20,
              ),
            ),
            SizedBox(width: compact ? 10 : 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    presented.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: chatTextStyle(
                      context,
                      fontSize: compact ? 13 : 14,
                      fontWeight: FontWeight.w600,
                      color: resolveChatColor(context, CupertinoColors.label),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    presented.body,
                    maxLines: compact ? 3 : 2,
                    overflow: TextOverflow.ellipsis,
                    style:
                        chatSecondaryTextStyle(
                          context,
                          fontSize: compact ? 12 : 13,
                        ).copyWith(
                          color: resolveChatColor(
                            context,
                            CupertinoColors.secondaryLabel,
                          ),
                        ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            retryButton,
          ],
        ),
      ),
    );
  }
}

class _PresentedErrorMessage {
  const _PresentedErrorMessage({required this.title, required this.body});

  final String title;
  final String body;
}

_PresentedErrorMessage _presentErrorMessage(
  BuildContext context,
  String rawMessage,
) {
  final l10n = ChatViewLocalizations.of(context);
  final normalized = rawMessage.toLowerCase();
  if (normalized.contains('failed to connect websocket') ||
      normalized.contains('websocketchannelexception') ||
      normalized.contains('connection closed before full header') ||
      normalized.contains('timed out')) {
    return _PresentedErrorMessage(
      title: l10n.connectionFailedTitle,
      body: l10n.connectionFailedBody,
    );
  }
  if (normalized.contains('transport is not connected')) {
    return _PresentedErrorMessage(
      title: l10n.disconnectedTitle,
      body: l10n.disconnectedBody,
    );
  }
  if (normalized.contains('room asset upload requires access token')) {
    return _PresentedErrorMessage(
      title: l10n.uploadRequiresTokenTitle,
      body: l10n.uploadRequiresTokenBody,
    );
  }
  if (normalized.contains('room asset upload failed')) {
    return _PresentedErrorMessage(
      title: l10n.uploadFailedTitle,
      body: l10n.uploadFailedBody,
    );
  }
  return _PresentedErrorMessage(
    title: l10n.defaultErrorTitle,
    body: rawMessage,
  );
}

class _EmptyTranscriptState extends StatelessWidget {
  const _EmptyTranscriptState();

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            constraints.maxHeight < 420 ||
            MediaQuery.sizeOf(context).width < 720;
        final inset = compact ? 20.0 : 28.0;
        return SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(24, inset, 24, inset),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: compact
                  ? 0
                  : (constraints.maxHeight - inset * 2).clamp(
                      0,
                      double.infinity,
                    ),
            ),
            child: Align(
              alignment: compact
                  ? (constraints.maxHeight < 300
                        ? Alignment.topCenter
                        : const Alignment(0, -0.16))
                  : const Alignment(0, -0.12),
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: compact ? 320 : 420),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.chat_bubble_2,
                      size: compact ? 24 : 34,
                      color: CupertinoTheme.of(context).primaryColor,
                    ),
                    SizedBox(height: compact ? 8 : 14),
                    Text(
                      l10n.transcriptEmptyTitle,
                      textAlign: TextAlign.center,
                      style: chatTextStyle(
                        context,
                        fontSize: compact ? 16 : 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: compact ? 4 : 8),
                    Text(
                      l10n.transcriptEmptyBody,
                      textAlign: TextAlign.center,
                      maxLines: compact ? 2 : null,
                      overflow: compact ? TextOverflow.ellipsis : null,
                      style: chatSecondaryTextStyle(
                        context,
                        fontSize: compact ? 12 : 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
