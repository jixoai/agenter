import 'package:flutter/cupertino.dart';

Color resolveIosColor(BuildContext context, Color color) {
  return CupertinoDynamicColor.maybeResolve(color, context) ?? color;
}

extension Ios26ThemeTextX on BuildContext {
  TextStyle get iosBodyTextStyle => CupertinoTheme.of(this).textTheme.textStyle;

  TextStyle iosTextStyle({
    double? fontSize,
    FontWeight? fontWeight,
    Color? color,
    double? height,
    TextDecoration? decoration,
  }) {
    return iosBodyTextStyle.copyWith(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      decoration: decoration,
    );
  }

  TextStyle get iosTitleTextStyle => iosTextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    color: resolveIosColor(this, CupertinoColors.label),
    height: 1.14,
  );

  TextStyle get iosSectionTextStyle => iosTextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: resolveIosColor(this, CupertinoColors.label),
    height: 1.24,
  );

  TextStyle get iosCaptionTextStyle => iosTextStyle(
    fontSize: 14,
    color: resolveIosColor(this, CupertinoColors.secondaryLabel),
    height: 1.29,
  );

  TextStyle get iosFootnoteTextStyle => iosTextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: resolveIosColor(this, CupertinoColors.secondaryLabel),
    height: 1.33,
  );

  TextStyle get iosEmphasisTextStyle => iosTextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    color: resolveIosColor(this, CupertinoColors.label),
    height: 1.24,
  );
}
