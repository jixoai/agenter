import 'package:flutter/cupertino.dart';

import 'apple_platform_theme.dart';

class AppleSection extends StatelessWidget {
  const AppleSection({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return CupertinoListSection.insetGrouped(
      margin: EdgeInsets.zero,
      backgroundColor: CupertinoColors.transparent,
      children: children,
    );
  }
}

class AppleSectionBody extends StatelessWidget {
  const AppleSectionBody({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? appleTokens(context).sectionBodyPadding,
      child: child,
    );
  }
}

class AppleSectionLabel extends StatelessWidget {
  const AppleSectionLabel({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: appleTokens(context).sectionLabelPadding,
      child: Text(
        title,
        style: context.appleFootnoteTextStyle.copyWith(
          fontWeight: FontWeight.w600,
          color: resolveAppleColor(context, CupertinoColors.secondaryLabel),
        ),
      ),
    );
  }
}

class ApplePanelGap extends StatelessWidget {
  const ApplePanelGap({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(height: appleTokens(context).sectionGap);
  }
}

class AppleActionGroup extends StatelessWidget {
  const AppleActionGroup({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (index, child) in children.indexed) ...[
          if (index > 0) SizedBox(height: appleTokens(context).controlGap),
          child,
        ],
      ],
    );
  }
}
