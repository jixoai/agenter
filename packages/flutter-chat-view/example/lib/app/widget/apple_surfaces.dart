import 'dart:async';
import 'dart:ui';

import 'package:flutter/cupertino.dart';

import 'apple_platform_theme.dart';

enum AppleSurfaceRole { sidebar, content, inspector, bar, notice }

class AppleMaterialSurface extends StatelessWidget {
  const AppleMaterialSurface({
    super.key,
    required this.child,
    this.role = AppleSurfaceRole.content,
    this.padding = EdgeInsets.zero,
    this.margin = EdgeInsets.zero,
    this.clip = true,
  });

  final Widget child;
  final AppleSurfaceRole role;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final metrics = _AppleSurfaceMetrics.resolve(context, role);
    final decoration = BoxDecoration(
      color: metrics.background,
      borderRadius: BorderRadius.circular(metrics.radius),
      border: metrics.drawsBorder
          ? Border.all(color: metrics.border, width: 0.5)
          : null,
    );
    final content = DecoratedBox(
      decoration: decoration,
      child: Padding(padding: padding, child: child),
    );
    final material = metrics.usesBlur
        ? BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: content,
          )
        : content;
    final surface = metrics.clips
        ? ClipRRect(
            borderRadius: BorderRadius.circular(metrics.radius),
            clipBehavior: clip ? Clip.antiAlias : Clip.none,
            child: material,
          )
        : material;
    return Padding(padding: margin, child: surface);
  }
}

class _AppleSurfaceMetrics {
  const _AppleSurfaceMetrics({
    required this.background,
    required this.border,
    required this.radius,
    required this.drawsBorder,
    required this.usesBlur,
  });

  final Color background;
  final Color border;
  final double radius;
  final bool drawsBorder;
  final bool usesBlur;

  bool get clips => radius > 0;

  static _AppleSurfaceMetrics resolve(
    BuildContext context,
    AppleSurfaceRole role,
  ) {
    final tokens = appleTokens(context);
    final sizeClass = applePlatformSizeClass(context);
    final (background, border, radius, alpha, drawsBorder, usesBlur) = switch ((
      sizeClass,
      role,
    )) {
      (ApplePlatformSizeClass.compact, AppleSurfaceRole.content) => (
        CupertinoColors.systemGroupedBackground,
        CupertinoColors.separator,
        0.0,
        1.0,
        false,
        false,
      ),
      (ApplePlatformSizeClass.compact, _) => (
        CupertinoColors.systemBackground,
        CupertinoColors.separator,
        0.0,
        1.0,
        true,
        false,
      ),
      (_, AppleSurfaceRole.sidebar) => (
        CupertinoColors.secondarySystemGroupedBackground,
        CupertinoColors.separator,
        0.0,
        1.0,
        true,
        false,
      ),
      (_, AppleSurfaceRole.content) => (
        CupertinoColors.systemBackground,
        CupertinoColors.separator,
        0.0,
        1.0,
        true,
        false,
      ),
      (_, AppleSurfaceRole.inspector) => (
        CupertinoColors.secondarySystemGroupedBackground,
        CupertinoColors.separator,
        0.0,
        1.0,
        true,
        false,
      ),
      (_, AppleSurfaceRole.bar) => (
        CupertinoColors.systemBackground,
        CupertinoColors.separator,
        tokens.surfaceRadius,
        0.92,
        true,
        true,
      ),
      (_, AppleSurfaceRole.notice) => (
        CupertinoColors.tertiarySystemGroupedBackground,
        CupertinoColors.separator,
        tokens.surfaceRadius,
        0.92,
        true,
        true,
      ),
    };
    return _AppleSurfaceMetrics(
      background: resolveAppleColor(
        context,
        background,
      ).withValues(alpha: alpha),
      border: resolveAppleColor(context, border).withValues(alpha: 0.36),
      radius: radius,
      drawsBorder: drawsBorder,
      usesBlur: usesBlur,
    );
  }
}

class AppleContentUnavailable extends StatelessWidget {
  const AppleContentUnavailable({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.primaryAction,
    this.secondaryAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? primaryAction;
  final Widget? secondaryAction;

  @override
  Widget build(BuildContext context) {
    final primary = CupertinoTheme.of(context).primaryColor;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 42, color: primary),
              const SizedBox(height: 14),
              Text(
                title,
                textAlign: TextAlign.center,
                style: context.appleTitleTextStyle,
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: context.appleCaptionTextStyle,
              ),
              if (primaryAction != null || secondaryAction != null) ...[
                const SizedBox(height: 20),
                ?primaryAction,
                if (secondaryAction != null) ...[
                  const SizedBox(height: 8),
                  secondaryAction!,
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

Future<void> showAppleToast(BuildContext context, String message) async {
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
            child: AppleMaterialSurface(
              role: AppleSurfaceRole.notice,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              child: Text(message, style: toastContext.appleCaptionTextStyle),
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

class AppleScrollbar extends StatefulWidget {
  const AppleScrollbar({
    super.key,
    required this.builder,
    this.thumbVisibility = true,
  });

  final Widget Function(BuildContext context, ScrollController controller)
  builder;
  final bool thumbVisibility;

  @override
  State<AppleScrollbar> createState() => _AppleScrollbarState();
}

class _AppleScrollbarState extends State<AppleScrollbar> {
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
