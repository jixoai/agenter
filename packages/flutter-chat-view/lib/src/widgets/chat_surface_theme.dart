import 'package:flutter/cupertino.dart';

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
  double radius = 26,
  Color? fillColor,
  Color? borderColor,
}) {
  return BoxDecoration(
    color:
        fillColor ??
        resolveChatColor(context, CupertinoColors.systemBackground),
    borderRadius: BorderRadius.circular(radius),
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
    radius: 24,
    fillColor: fillColor,
    borderColor: borderColor,
  );
}

class ChatMetaPill extends StatelessWidget {
  const ChatMetaPill({
    super.key,
    required this.label,
    this.icon,
    this.tintColor,
    this.emphasized = false,
  });

  final String label;
  final IconData? icon;
  final Color? tintColor;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final tint = tintColor ?? CupertinoTheme.of(context).primaryColor;
    final background = emphasized
        ? tint.withValues(alpha: 0.1)
        : resolveChatColor(
            context,
            CupertinoColors.tertiarySystemGroupedBackground,
          );
    final foreground = emphasized
        ? tint
        : resolveChatColor(context, CupertinoColors.label);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 12, color: foreground),
              const SizedBox(width: 5),
            ],
            Text(
              label,
              style: chatSecondaryTextStyle(
                context,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ).copyWith(color: foreground),
            ),
          ],
        ),
      ),
    );
  }
}
