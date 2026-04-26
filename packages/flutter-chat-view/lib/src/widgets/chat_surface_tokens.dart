import 'package:flutter/cupertino.dart';

class ChatSurfaceTokens {
  const ChatSurfaceTokens({
    required this.panelRadius,
    required this.bubbleRadius,
    required this.blockRadius,
    required this.controlRadius,
    required this.messageMaxWidth,
    required this.messageVerticalGap,
    required this.messagePadding,
    required this.blockGap,
    required this.blockPadding,
    required this.composerOuterPadding,
    required this.compactComposerOuterPadding,
    required this.composerBarPadding,
    required this.composerFieldPadding,
    required this.composerActionSize,
    required this.inlineGap,
    required this.pillPadding,
    required this.transcriptPadding,
    required this.timeDividerPadding,
    required this.noticeRadius,
    required this.noticePadding,
    required this.compactNoticePadding,
    required this.noticeIconSize,
    required this.compactNoticeIconSize,
    required this.noticeIconGap,
    required this.compactNoticeIconGap,
    required this.emptyTranscriptPadding,
    required this.compactEmptyTranscriptPadding,
    required this.emptyTranscriptMaxWidth,
    required this.compactEmptyTranscriptMaxWidth,
    required this.emptyTranscriptIconSize,
    required this.compactEmptyTranscriptIconSize,
    required this.emptyTranscriptTitleGap,
    required this.compactEmptyTranscriptTitleGap,
    required this.emptyTranscriptBodyGap,
    required this.compactEmptyTranscriptBodyGap,
    required this.latestControlPadding,
    required this.latestControlIconGap,
    required this.latestControlTrailingInset,
    required this.latestControlBottomInset,
    required this.compactLatestControlBottomInset,
    required this.latestVisibilityDistance,
    required this.latestAutoFollowDistance,
    required this.olderPageTriggerDistance,
    required this.latestScrollDuration,
  });

  final double panelRadius;
  final double bubbleRadius;
  final double blockRadius;
  final double controlRadius;
  final double messageMaxWidth;
  final double messageVerticalGap;
  final EdgeInsets messagePadding;
  final double blockGap;
  final EdgeInsets blockPadding;
  final EdgeInsets composerOuterPadding;
  final EdgeInsets compactComposerOuterPadding;
  final EdgeInsets composerBarPadding;
  final EdgeInsets composerFieldPadding;
  final double composerActionSize;
  final double inlineGap;
  final EdgeInsets pillPadding;
  final EdgeInsets transcriptPadding;
  final EdgeInsets timeDividerPadding;
  final double noticeRadius;
  final EdgeInsets noticePadding;
  final EdgeInsets compactNoticePadding;
  final double noticeIconSize;
  final double compactNoticeIconSize;
  final double noticeIconGap;
  final double compactNoticeIconGap;
  final EdgeInsets emptyTranscriptPadding;
  final EdgeInsets compactEmptyTranscriptPadding;
  final double emptyTranscriptMaxWidth;
  final double compactEmptyTranscriptMaxWidth;
  final double emptyTranscriptIconSize;
  final double compactEmptyTranscriptIconSize;
  final double emptyTranscriptTitleGap;
  final double compactEmptyTranscriptTitleGap;
  final double emptyTranscriptBodyGap;
  final double compactEmptyTranscriptBodyGap;
  final EdgeInsets latestControlPadding;
  final double latestControlIconGap;
  final double latestControlTrailingInset;
  final double latestControlBottomInset;
  final double compactLatestControlBottomInset;
  final double latestVisibilityDistance;
  final double latestAutoFollowDistance;
  final double olderPageTriggerDistance;
  final Duration latestScrollDuration;

  static const defaults = ChatSurfaceTokens(
    panelRadius: 26,
    bubbleRadius: 22,
    blockRadius: 14,
    controlRadius: 999,
    messageMaxWidth: 720,
    messageVerticalGap: 6,
    messagePadding: EdgeInsets.all(14),
    blockGap: 10,
    blockPadding: EdgeInsets.all(12),
    composerOuterPadding: EdgeInsets.fromLTRB(12, 10, 12, 12),
    compactComposerOuterPadding: EdgeInsets.fromLTRB(12, 8, 12, 10),
    composerBarPadding: EdgeInsets.fromLTRB(12, 10, 12, 10),
    composerFieldPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12),
    composerActionSize: 48,
    inlineGap: 6,
    pillPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    transcriptPadding: EdgeInsets.all(16),
    timeDividerPadding: EdgeInsets.symmetric(vertical: 12),
    noticeRadius: 20,
    noticePadding: EdgeInsets.fromLTRB(14, 12, 14, 12),
    compactNoticePadding: EdgeInsets.fromLTRB(12, 10, 12, 10),
    noticeIconSize: 20,
    compactNoticeIconSize: 18,
    noticeIconGap: 12,
    compactNoticeIconGap: 10,
    emptyTranscriptPadding: EdgeInsets.fromLTRB(24, 28, 24, 28),
    compactEmptyTranscriptPadding: EdgeInsets.fromLTRB(24, 20, 24, 20),
    emptyTranscriptMaxWidth: 420,
    compactEmptyTranscriptMaxWidth: 320,
    emptyTranscriptIconSize: 34,
    compactEmptyTranscriptIconSize: 24,
    emptyTranscriptTitleGap: 14,
    compactEmptyTranscriptTitleGap: 8,
    emptyTranscriptBodyGap: 8,
    compactEmptyTranscriptBodyGap: 4,
    latestControlPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    latestControlIconGap: 8,
    latestControlTrailingInset: 20,
    latestControlBottomInset: 112,
    compactLatestControlBottomInset: 96,
    latestVisibilityDistance: 240,
    latestAutoFollowDistance: 120,
    olderPageTriggerDistance: 96,
    latestScrollDuration: Duration(milliseconds: 220),
  );
}

ChatSurfaceTokens chatTokens(BuildContext context) =>
    ChatSurfaceTokens.defaults;

EdgeInsets chatComposerOuterPadding(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactComposerOuterPadding
      : tokens.composerOuterPadding;
}

EdgeInsets chatStageNoticePadding(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact ? tokens.compactNoticePadding : tokens.noticePadding;
}

double chatStageNoticeIconSize(BuildContext context, {required bool compact}) {
  final tokens = chatTokens(context);
  return compact ? tokens.compactNoticeIconSize : tokens.noticeIconSize;
}

double chatStageNoticeIconGap(BuildContext context, {required bool compact}) {
  final tokens = chatTokens(context);
  return compact ? tokens.compactNoticeIconGap : tokens.noticeIconGap;
}

EdgeInsets chatEmptyTranscriptPadding(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactEmptyTranscriptPadding
      : tokens.emptyTranscriptPadding;
}

double chatEmptyTranscriptMaxWidth(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactEmptyTranscriptMaxWidth
      : tokens.emptyTranscriptMaxWidth;
}

double chatEmptyTranscriptIconSize(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactEmptyTranscriptIconSize
      : tokens.emptyTranscriptIconSize;
}

double chatEmptyTranscriptTitleGap(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactEmptyTranscriptTitleGap
      : tokens.emptyTranscriptTitleGap;
}

double chatEmptyTranscriptBodyGap(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactEmptyTranscriptBodyGap
      : tokens.emptyTranscriptBodyGap;
}

double chatLatestControlBottomInset(
  BuildContext context, {
  required bool compact,
}) {
  final tokens = chatTokens(context);
  return compact
      ? tokens.compactLatestControlBottomInset
      : tokens.latestControlBottomInset;
}
