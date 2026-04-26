import 'package:flutter/cupertino.dart';

import 'chat_surface_theme.dart';

class ChatReturnToLatestControl extends StatelessWidget {
  const ChatReturnToLatestControl({
    super.key,
    required this.visible,
    required this.busy,
    required this.label,
    required this.onPressed,
  });

  final bool visible;
  final bool busy;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final tokens = chatTokens(context);
    return IgnorePointer(
      ignoring: !visible || busy,
      child: ExcludeSemantics(
        excluding: !visible,
        child: AnimatedOpacity(
          opacity: visible ? 1 : 0,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          child: CupertinoButton.filled(
            padding: tokens.latestControlPadding,
            onPressed: busy ? null : onPressed,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (busy)
                  const CupertinoActivityIndicator(radius: 8)
                else
                  const Icon(CupertinoIcons.arrow_down),
                SizedBox(width: tokens.latestControlIconGap),
                Text(label),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
