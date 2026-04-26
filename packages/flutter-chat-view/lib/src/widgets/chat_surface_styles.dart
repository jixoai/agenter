import 'package:flutter/cupertino.dart';

import 'chat_surface_tokens.dart';

Color resolveChatColor(BuildContext context, Color color) {
  return CupertinoDynamicColor.maybeResolve(color, context) ?? color;
}

TextStyle chatTextStyle(
  BuildContext context, {
  double? fontSize,
  FontWeight? fontWeight,
  Color? color,
  double? height,
}) {
  return CupertinoTheme.of(context).textTheme.textStyle.copyWith(
    fontSize: fontSize,
    fontWeight: fontWeight,
    color: color,
    height: height,
  );
}

TextStyle chatSecondaryTextStyle(
  BuildContext context, {
  double? fontSize,
  FontWeight? fontWeight,
}) {
  return chatTextStyle(
    context,
    fontSize: fontSize,
    fontWeight: fontWeight,
    color: resolveChatColor(context, CupertinoColors.secondaryLabel),
    height: 1.3,
  );
}

BoxDecoration buildChatCanvasDecoration(BuildContext context) {
  return BoxDecoration(
    color: resolveChatColor(context, CupertinoColors.systemGroupedBackground),
  );
}

BoxDecoration buildChatPanelDecoration(
  BuildContext context, {
  double? radius,
  Color? fillColor,
  Color? borderColor,
}) {
  return BoxDecoration(
    color:
        fillColor ??
        resolveChatColor(context, CupertinoColors.systemBackground),
    borderRadius: BorderRadius.circular(
      radius ?? chatTokens(context).panelRadius,
    ),
    border: borderColor == null ? null : Border.all(color: borderColor),
  );
}

BoxDecoration buildChatBubbleDecoration(
  BuildContext context, {
  required bool viewerOwned,
  required bool selected,
}) {
  final primary = CupertinoTheme.of(context).primaryColor;
  final fillColor = viewerOwned
      ? Color.alphaBlend(
          primary.withValues(alpha: 0.1),
          resolveChatColor(context, CupertinoColors.systemBackground),
        )
      : resolveChatColor(
          context,
          CupertinoColors.secondarySystemGroupedBackground,
        );
  final borderColor = selected
      ? primary.withValues(alpha: 0.28)
      : resolveChatColor(context, CupertinoColors.separator);
  return buildChatPanelDecoration(
    context,
    radius: chatTokens(context).bubbleRadius,
    fillColor: fillColor,
    borderColor: borderColor,
  );
}
