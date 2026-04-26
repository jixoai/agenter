import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart' show Tooltip;

import 'apple_platform_theme.dart';

class AppleIconButton extends StatelessWidget {
  const AppleIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.color,
    this.size = 22,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final tokens = appleTokens(context);
    final resolvedColor = color ?? CupertinoTheme.of(context).primaryColor;
    return Tooltip(
      message: label,
      excludeFromSemantics: true,
      child: Semantics(
        container: true,
        button: true,
        enabled: onPressed != null,
        label: label,
        onTap: onPressed,
        child: ExcludeSemantics(
          child: CupertinoButton(
            padding: EdgeInsets.zero,
            minimumSize: Size.square(tokens.minimumHitSize),
            alignment: Alignment.center,
            onPressed: onPressed,
            child: Icon(icon, size: size, color: resolvedColor),
          ),
        ),
      ),
    );
  }
}
