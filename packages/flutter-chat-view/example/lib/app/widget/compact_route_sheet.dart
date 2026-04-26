import 'package:flutter/cupertino.dart';

import '../l10n/product_shell_localizations.dart';
import 'apple_icon_button.dart';

enum CompactRouteSheetDetent { page, inspector }

extension CompactRouteSheetDetentX on CompactRouteSheetDetent {
  double resolveHeight(double viewportHeight) {
    final factor = switch (this) {
      CompactRouteSheetDetent.page => 0.92,
      CompactRouteSheetDetent.inspector => 0.76,
    };
    final minHeight = switch (this) {
      CompactRouteSheetDetent.page => 560.0,
      CompactRouteSheetDetent.inspector => 420.0,
    };
    return (viewportHeight * factor)
        .clamp(minHeight.clamp(0, viewportHeight), viewportHeight)
        .toDouble();
  }
}

class CompactRouteSheet extends StatelessWidget {
  const CompactRouteSheet({
    super.key,
    required this.title,
    required this.onClose,
    required this.child,
    this.detent = CompactRouteSheetDetent.page,
  });

  final String title;
  final VoidCallback onClose;
  final Widget child;
  final CompactRouteSheetDetent detent;

  @override
  Widget build(BuildContext context) {
    final viewport = MediaQuery.sizeOf(context);
    final viewInsets = MediaQuery.viewInsetsOf(context);
    final topRadius = BorderRadius.vertical(top: const Radius.circular(18));
    return SafeArea(
      top: false,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: EdgeInsets.only(bottom: viewInsets.bottom),
          child: SizedBox(
            width: viewport.width,
            height: detent.resolveHeight(viewport.height),
            child: ClipRRect(
              borderRadius: topRadius,
              child: CupertinoPopupSurface(
                child: CupertinoPageScaffold(
                  navigationBar: CupertinoNavigationBar(
                    border: null,
                    automaticallyImplyLeading: false,
                    middle: Text(title),
                    trailing: AppleIconButton(
                      icon: CupertinoIcons.xmark_circle_fill,
                      label: ProductShellLocalizations.of(context).close,
                      onPressed: onClose,
                    ),
                  ),
                  child: SafeArea(top: false, bottom: true, child: child),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
