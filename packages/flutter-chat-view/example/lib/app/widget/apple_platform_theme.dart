import 'package:flutter/cupertino.dart';

class ApplePlatformTokens {
  const ApplePlatformTokens({
    required this.shellMargins,
    required this.columnGap,
    required this.compactShellMargins,
    required this.surfaceRadius,
    required this.largeSurfaceRadius,
    required this.controlRadius,
    required this.minimumHitSize,
    required this.sectionGap,
    required this.controlGap,
    required this.sectionBodyPadding,
    required this.sectionActionPadding,
    required this.sectionLabelPadding,
    required this.emptyStatePadding,
  });

  final EdgeInsets shellMargins;
  final double columnGap;
  final EdgeInsets compactShellMargins;
  final double surfaceRadius;
  final double largeSurfaceRadius;
  final double controlRadius;
  final double minimumHitSize;
  final double sectionGap;
  final double controlGap;
  final EdgeInsets sectionBodyPadding;
  final EdgeInsets sectionActionPadding;
  final EdgeInsets sectionLabelPadding;
  final EdgeInsets emptyStatePadding;

  static const defaults = ApplePlatformTokens(
    shellMargins: EdgeInsets.zero,
    columnGap: 1,
    compactShellMargins: EdgeInsets.zero,
    surfaceRadius: 12,
    largeSurfaceRadius: 14,
    controlRadius: 12,
    minimumHitSize: 44,
    sectionGap: 10,
    controlGap: 8,
    sectionBodyPadding: EdgeInsets.fromLTRB(20, 16, 20, 18),
    sectionActionPadding: EdgeInsets.fromLTRB(16, 14, 16, 16),
    sectionLabelPadding: EdgeInsets.fromLTRB(20, 6, 20, 6),
    emptyStatePadding: EdgeInsets.fromLTRB(20, 22, 20, 18),
  );
}

enum ApplePlatformSizeClass { compact, regular, expanded }

ApplePlatformSizeClass applePlatformSizeClass(BuildContext context) {
  final width = MediaQuery.sizeOf(context).width;
  if (width < 720) {
    return ApplePlatformSizeClass.compact;
  }
  if (width < 1100) {
    return ApplePlatformSizeClass.regular;
  }
  return ApplePlatformSizeClass.expanded;
}

extension ApplePlatformSizeClassX on ApplePlatformSizeClass {
  bool get isCompact => this == ApplePlatformSizeClass.compact;
}

CupertinoThemeData buildApplePlatformTheme() {
  const primary = CupertinoColors.systemBlue;
  return const CupertinoThemeData(
    brightness: Brightness.light,
    primaryColor: primary,
    scaffoldBackgroundColor: CupertinoColors.systemGroupedBackground,
    barBackgroundColor: CupertinoColors.systemBackground,
    textTheme: CupertinoTextThemeData(
      primaryColor: primary,
      textStyle: TextStyle(
        color: CupertinoColors.label,
        fontSize: 17,
        height: 1.29,
      ),
      actionTextStyle: TextStyle(
        color: primary,
        fontSize: 17,
        fontWeight: FontWeight.w400,
      ),
      navTitleTextStyle: TextStyle(
        color: CupertinoColors.label,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
      navLargeTitleTextStyle: TextStyle(
        color: CupertinoColors.label,
        fontSize: 34,
        fontWeight: FontWeight.w700,
      ),
      navActionTextStyle: TextStyle(
        color: primary,
        fontSize: 17,
        fontWeight: FontWeight.w400,
      ),
      tabLabelTextStyle: TextStyle(
        color: CupertinoColors.secondaryLabel,
        fontSize: 10,
        fontWeight: FontWeight.w500,
      ),
    ),
  );
}

Color resolveAppleColor(BuildContext context, Color color) {
  return CupertinoDynamicColor.maybeResolve(color, context) ?? color;
}

ApplePlatformTokens appleTokens(BuildContext context) =>
    ApplePlatformTokens.defaults;

EdgeInsets appleShellMargins(BuildContext context) {
  final tokens = appleTokens(context);
  final viewPadding = MediaQuery.viewPaddingOf(context);
  if (applePlatformSizeClass(context).isCompact) {
    return tokens.compactShellMargins;
  }
  return tokens.shellMargins.copyWith(
    left: tokens.shellMargins.left + viewPadding.left,
    right: tokens.shellMargins.right + viewPadding.right,
  );
}

extension ApplePlatformTextX on BuildContext {
  TextStyle get appleBodyTextStyle =>
      CupertinoTheme.of(this).textTheme.textStyle;

  TextStyle appleTextStyle({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    TextDecoration? decoration,
  }) {
    return appleBodyTextStyle.copyWith(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      decoration: decoration,
    );
  }

  TextStyle get appleTitleTextStyle => appleTextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    color: resolveAppleColor(this, CupertinoColors.label),
    height: 1.12,
  );

  TextStyle get appleSectionTextStyle => appleTextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: resolveAppleColor(this, CupertinoColors.label),
    height: 1.22,
  );

  TextStyle get appleCaptionTextStyle => appleTextStyle(
    fontSize: 13,
    color: resolveAppleColor(this, CupertinoColors.secondaryLabel),
    height: 1.28,
  );

  TextStyle get appleFootnoteTextStyle => appleTextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: resolveAppleColor(this, CupertinoColors.secondaryLabel),
    height: 1.3,
  );

  TextStyle get appleEmphasisTextStyle => appleTextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: resolveAppleColor(this, CupertinoColors.label),
    height: 1.22,
  );
}
