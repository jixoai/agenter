import 'package:flutter/cupertino.dart';

CupertinoThemeData buildIos26Theme() {
  const primary = Color(0xFF0071E3);
  const background = Color(0xFFF5F5F7);
  const barBackground = Color(0xCCF5F5F7);

  return const CupertinoThemeData(
    brightness: Brightness.light,
    primaryColor: primary,
    scaffoldBackgroundColor: background,
    barBackgroundColor: barBackground,
    textTheme: CupertinoTextThemeData(
      primaryColor: primary,
      textStyle: TextStyle(
        color: CupertinoColors.label,
        fontSize: 17,
        height: 1.47,
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
        fontSize: 11,
        fontWeight: FontWeight.w400,
      ),
    ),
  );
}
