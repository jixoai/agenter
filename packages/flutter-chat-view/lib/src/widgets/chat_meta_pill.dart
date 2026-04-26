import 'package:flutter/cupertino.dart';

import 'chat_surface_styles.dart';
import 'chat_surface_tokens.dart';

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
        borderRadius: BorderRadius.circular(chatTokens(context).controlRadius),
      ),
      child: Padding(
        padding: chatTokens(context).pillPadding,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 12, color: foreground),
              SizedBox(width: chatTokens(context).inlineGap),
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
