import 'package:flutter/cupertino.dart';

class Ios26IconButton extends StatelessWidget {
  const Ios26IconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.color,
    this.size = 22,
    this.minimumSize = const Size.square(44),
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final Color? color;
  final double size;
  final Size minimumSize;

  @override
  Widget build(BuildContext context) {
    final resolvedColor = color ?? CupertinoTheme.of(context).primaryColor;
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        minimumSize: minimumSize,
        alignment: Alignment.center,
        onPressed: onPressed,
        child: Icon(icon, size: size, color: resolvedColor),
      ),
    );
  }
}
