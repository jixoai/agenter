import 'package:flutter/cupertino.dart';

import '../l10n/chat_view_localizations.dart';
import 'chat_surface_theme.dart';

class ChatStageErrorBanner extends StatelessWidget {
  const ChatStageErrorBanner({
    super.key,
    required this.message,
    required this.onRetry,
  });

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
    return DecoratedBox(
      decoration: buildChatPanelDecoration(
        context,
        radius: chatTokens(context).noticeRadius,
        fillColor: errorColor.withValues(alpha: 0.1),
        borderColor: errorColor.withValues(alpha: 0.18),
      ),
      child: Padding(
        padding: chatStageNoticePadding(context, compact: compact),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(
                CupertinoIcons.exclamationmark_triangle,
                color: errorColor,
                size: chatStageNoticeIconSize(context, compact: compact),
              ),
            ),
            SizedBox(width: chatStageNoticeIconGap(context, compact: compact)),
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
            CupertinoButton(
              padding: compact
                  ? const EdgeInsets.symmetric(horizontal: 10, vertical: 8)
                  : EdgeInsets.zero,
              minimumSize: Size(compact ? 44 : 44, compact ? 36 : 44),
              alignment: Alignment.center,
              onPressed: onRetry,
              child: retryLabel,
            ),
          ],
        ),
      ),
    );
  }
}

class ChatEmptyTranscriptState extends StatelessWidget {
  const ChatEmptyTranscriptState({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = ChatViewLocalizations.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            constraints.maxHeight < 420 ||
            MediaQuery.sizeOf(context).width < 720;
        final padding = chatEmptyTranscriptPadding(context, compact: compact);
        return SingleChildScrollView(
          padding: padding,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: compact
                  ? 0
                  : (constraints.maxHeight - padding.vertical).clamp(
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
                constraints: BoxConstraints(
                  maxWidth: chatEmptyTranscriptMaxWidth(
                    context,
                    compact: compact,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.chat_bubble_2,
                      size: chatEmptyTranscriptIconSize(
                        context,
                        compact: compact,
                      ),
                      color: CupertinoTheme.of(context).primaryColor,
                    ),
                    SizedBox(
                      height: chatEmptyTranscriptTitleGap(
                        context,
                        compact: compact,
                      ),
                    ),
                    Text(
                      l10n.transcriptEmptyTitle,
                      textAlign: TextAlign.center,
                      style: chatTextStyle(
                        context,
                        fontSize: compact ? 16 : 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(
                      height: chatEmptyTranscriptBodyGap(
                        context,
                        compact: compact,
                      ),
                    ),
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
