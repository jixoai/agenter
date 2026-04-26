import 'dart:async';

import 'package:flutter/cupertino.dart';

import '../controller/chat_view_controller.dart';
import '../l10n/chat_view_localizations.dart';
import '../model/chat_models.dart';
import '../model/chat_view_state.dart';
import '../plugin/composer_plugin.dart';
import 'chat_composer.dart';
import 'chat_stage_controls.dart';
import 'chat_stage_notices.dart';
import 'chat_surface_theme.dart';
import 'chat_transcript_viewport.dart';

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
  bool _scrollingToLatest = false;
  bool _initialLatestAnchorApplied = false;
  bool _initialLatestAnchorScheduled = false;
  bool _olderAnchorRestoreScheduled = false;
  _OlderPageAnchor? _pendingOlderPageAnchor;

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
      _resetTranscriptAnchors();
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
    final state = widget.controller.state;
    if (!_initialLatestAnchorApplied || _pendingOlderPageAnchor != null) {
      return;
    }
    final distanceToLatest = _distanceToLatest();
    if (distanceToLatest == null ||
        distanceToLatest >= chatTokens(context).latestAutoFollowDistance ||
        state.loadingMore) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      unawaited(
        _scrollToLatest(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        ),
      );
    });
  }

  void _handleScrollChanged() {
    final distanceToLatest = _distanceToLatest();
    if (distanceToLatest == null) {
      return;
    }
    final nextShow =
        distanceToLatest > chatTokens(context).latestVisibilityDistance;
    if (mounted && nextShow != _showReturnToLatest) {
      setState(() {
        _showReturnToLatest = nextShow;
      });
    }
    _refreshPendingOlderPageAnchor();
  }

  bool _handleScrollNotification(ScrollNotification notification) {
    final isUserUpdate = switch (notification) {
      ScrollUpdateNotification(dragDetails: final details) => details != null,
      OverscrollNotification(dragDetails: final details) => details != null,
      _ => false,
    };
    if (notification.metrics.axis == Axis.vertical && isUserUpdate) {
      _requestOlderPageIfNeeded();
    }
    return false;
  }

  Future<void> _jumpToLatest() async {
    await _scrollToLatest(
      duration: chatTokens(context).latestScrollDuration,
      curve: Curves.easeOutCubic,
      reportBusy: true,
    );
  }

  double? _distanceToLatest() {
    if (!_scrollController.hasClients) {
      return null;
    }
    final position = _scrollController.position;
    if (!position.hasContentDimensions) {
      return null;
    }
    return (position.maxScrollExtent - position.pixels).clamp(
      0,
      double.infinity,
    );
  }

  void _scheduleTranscriptAnchors(ChatViewState state) {
    _scheduleInitialLatestAnchorIfNeeded(state);
    _scheduleOlderPageAnchorRestoreIfNeeded(state);
  }

  void _scheduleInitialLatestAnchorIfNeeded(ChatViewState state) {
    if (_initialLatestAnchorApplied ||
        _initialLatestAnchorScheduled ||
        state.messages.isEmpty) {
      return;
    }
    _initialLatestAnchorScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initialLatestAnchorScheduled = false;
      if (!mounted ||
          _initialLatestAnchorApplied ||
          widget.controller.state.messages.isEmpty) {
        return;
      }
      _initialLatestAnchorApplied = _jumpToLatestEdge();
    });
  }

  void _scheduleOlderPageAnchorRestoreIfNeeded(ChatViewState state) {
    if (_pendingOlderPageAnchor == null ||
        _olderAnchorRestoreScheduled ||
        state.loadingMore) {
      return;
    }
    _olderAnchorRestoreScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _olderAnchorRestoreScheduled = false;
      final anchor = _pendingOlderPageAnchor;
      if (!mounted || anchor == null) {
        return;
      }
      _pendingOlderPageAnchor = null;
      if (!_scrollController.hasClients) {
        return;
      }
      final position = _scrollController.position;
      if (!position.hasContentDimensions) {
        return;
      }
      final insertedExtent = position.maxScrollExtent - anchor.maxScrollExtent;
      final target = (anchor.pixels + insertedExtent).clamp(
        position.minScrollExtent,
        position.maxScrollExtent,
      );
      position.jumpTo(target.toDouble());
      _handleScrollChanged();
    });
  }

  bool _jumpToLatestEdge() {
    if (!_scrollController.hasClients) {
      return false;
    }
    final position = _scrollController.position;
    if (!position.hasContentDimensions) {
      return false;
    }
    position.jumpTo(position.maxScrollExtent);
    _handleScrollChanged();
    return true;
  }

  void _requestOlderPageIfNeeded() {
    if (!_initialLatestAnchorApplied || _pendingOlderPageAnchor != null) {
      return;
    }
    final state = widget.controller.state;
    if (!state.hasMoreBefore || state.loadingMore) {
      return;
    }
    if (!_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    if (!position.hasContentDimensions ||
        position.pixels > chatTokens(context).olderPageTriggerDistance) {
      return;
    }
    _pendingOlderPageAnchor = _OlderPageAnchor(
      pixels: position.pixels
          .clamp(position.minScrollExtent, position.maxScrollExtent)
          .toDouble(),
      maxScrollExtent: position.maxScrollExtent,
    );
    unawaited(
      widget.controller.requestOlderPage().catchError((Object _) {
        if (mounted) {
          _pendingOlderPageAnchor = null;
        }
      }),
    );
  }

  void _refreshPendingOlderPageAnchor() {
    if (_pendingOlderPageAnchor == null ||
        !widget.controller.state.loadingMore ||
        !_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    if (!position.hasContentDimensions) {
      return;
    }
    _pendingOlderPageAnchor = _OlderPageAnchor(
      pixels: position.pixels
          .clamp(position.minScrollExtent, position.maxScrollExtent)
          .toDouble(),
      maxScrollExtent: position.maxScrollExtent,
    );
  }

  void _resetTranscriptAnchors() {
    _initialLatestAnchorApplied = false;
    _initialLatestAnchorScheduled = false;
    _olderAnchorRestoreScheduled = false;
    _pendingOlderPageAnchor = null;
    _showReturnToLatest = false;
    _scrollingToLatest = false;
  }

  Future<void> _scrollToLatest({
    required Duration duration,
    required Curve curve,
    bool reportBusy = false,
  }) async {
    if (!_scrollController.hasClients) {
      return;
    }
    final position = _scrollController.position;
    if (!position.hasContentDimensions) {
      return;
    }
    final target = position.maxScrollExtent.clamp(
      position.minScrollExtent,
      position.maxScrollExtent,
    );
    if (reportBusy && mounted) {
      setState(() {
        _scrollingToLatest = true;
      });
    }
    try {
      if ((target - position.pixels).abs() < 1) {
        position.jumpTo(target);
      } else {
        await _scrollController.animateTo(
          target,
          duration: duration,
          curve: curve,
        );
      }
    } catch (_) {
      return;
    } finally {
      if (reportBusy && mounted) {
        setState(() {
          _scrollingToLatest = false;
        });
      }
      if (mounted) {
        _handleScrollChanged();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, child) {
        final l10n = ChatViewLocalizations.of(context);
        final state = widget.controller.state;
        _scheduleTranscriptAnchors(state);
        final compact = MediaQuery.sizeOf(context).width < 720;
        return Stack(
          children: [
            Column(
              children: [
                if (state.errorMessage case final errorMessage?)
                  Padding(
                    padding: chatComposerOuterPadding(
                      context,
                      compact: compact,
                    ).copyWith(bottom: 0),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxWidth: compact ? double.infinity : 720,
                        ),
                        child: ChatStageErrorBanner(
                          message: errorMessage,
                          onRetry: widget.controller.connect,
                        ),
                      ),
                    ),
                  ),
                Expanded(
                  child: NotificationListener<ScrollNotification>(
                    onNotification: _handleScrollNotification,
                    child: ChatTranscriptViewport(
                      controller: widget.controller,
                      state: state,
                      scrollController: _scrollController,
                      compact: compact,
                      selectedMessageViewKey: widget.selectedMessageViewKey,
                      onMessageSelected: widget.onMessageSelected,
                      editingMessageChanged: (value) =>
                          setState(() => _editingMessage = value),
                    ),
                  ),
                ),
                Padding(
                  padding: chatComposerOuterPadding(context, compact: compact),
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
            Positioned(
              right: chatTokens(context).latestControlTrailingInset,
              bottom: chatLatestControlBottomInset(context, compact: compact),
              child: ChatReturnToLatestControl(
                visible: _showReturnToLatest,
                busy: _scrollingToLatest,
                label: l10n.latest,
                onPressed: _jumpToLatest,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OlderPageAnchor {
  const _OlderPageAnchor({required this.pixels, required this.maxScrollExtent});

  final double pixels;
  final double maxScrollExtent;
}
