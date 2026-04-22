import 'dart:async';

import 'package:flutter/cupertino.dart';

import 'ios26_theme_extension.dart';

Future<void> showIos26Toast(BuildContext context, String message) async {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) {
    return;
  }
  final entry = OverlayEntry(
    builder: (toastContext) => Positioned(
      left: 24,
      right: 24,
      bottom: 32,
      child: IgnorePointer(
        child: SafeArea(
          top: false,
          child: Center(
            child: CupertinoPopupSurface(
              isSurfacePainted: true,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
                child: Text(message, style: toastContext.iosCaptionTextStyle),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  overlay.insert(entry);
  await Future<void>.delayed(const Duration(milliseconds: 1600));
  entry.remove();
}

class Ios26Scrollbar extends StatefulWidget {
  const Ios26Scrollbar({
    super.key,
    required this.builder,
    this.thumbVisibility = true,
  });

  final Widget Function(BuildContext context, ScrollController controller)
  builder;
  final bool thumbVisibility;

  @override
  State<Ios26Scrollbar> createState() => _Ios26ScrollbarState();
}

class _Ios26ScrollbarState extends State<Ios26Scrollbar> {
  final ScrollController _controller = ScrollController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoScrollbar(
      controller: _controller,
      thumbVisibility: widget.thumbVisibility,
      child: widget.builder(context, _controller),
    );
  }
}
