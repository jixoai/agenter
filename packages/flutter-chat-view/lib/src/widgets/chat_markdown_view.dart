import 'package:flutter/cupertino.dart';
import 'package:markdown/markdown.dart' as md;

import 'chat_surface_theme.dart';

class ChatMarkdownView extends StatelessWidget {
  const ChatMarkdownView({required this.markdown, super.key});

  final String markdown;

  @override
  Widget build(BuildContext context) {
    final document = md.Document(encodeHtml: false);
    final nodes = document.parseLines(
      markdown.replaceAll('\r\n', '\n').split('\n'),
    );
    if (nodes.isEmpty) {
      return const SizedBox.shrink();
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: nodes
          .map((node) => _renderBlock(context, node))
          .toList(growable: false),
    );
  }

  Widget _renderBlock(BuildContext context, md.Node node) {
    if (node is md.Element && node.tag == 'pre') {
      final codeNode = node.children?.whereType<md.Element>().firstWhere(
        (child) => child.tag == 'code',
      );
      final text =
          codeNode?.textContent.trimRight() ?? node.textContent.trimRight();
      return Container(
        width: double.infinity,
        margin: EdgeInsets.only(top: chatTokens(context).inlineGap),
        padding: chatTokens(context).blockPadding,
        decoration: BoxDecoration(
          color: resolveChatColor(
            context,
            CupertinoColors.tertiarySystemGroupedBackground,
          ),
          borderRadius: BorderRadius.circular(chatTokens(context).blockRadius),
        ),
        child: Text(
          text,
          style: chatTextStyle(
            context,
            fontSize: 13,
            color: resolveChatColor(context, CupertinoColors.label),
          ).copyWith(fontFamily: 'monospace'),
        ),
      );
    }
    if (node is md.Element && node.tag == 'blockquote') {
      return Container(
        margin: EdgeInsets.only(top: chatTokens(context).inlineGap),
        padding: EdgeInsets.only(left: chatTokens(context).blockPadding.left),
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(
              color: resolveChatColor(context, CupertinoColors.separator),
              width: 3,
            ),
          ),
        ),
        child: _renderInline(context, node.children ?? const <md.Node>[]),
      );
    }
    return Padding(
      padding: EdgeInsets.only(top: chatTokens(context).inlineGap),
      child: _renderInline(
        context,
        node is md.Element
            ? node.children ?? const <md.Node>[]
            : <md.Node>[node],
      ),
    );
  }

  Widget _renderInline(BuildContext context, List<md.Node> nodes) {
    final base = chatTextStyle(
      context,
      fontSize: 15,
      color: resolveChatColor(context, CupertinoColors.label),
      height: 1.38,
    );
    return Text.rich(
      TextSpan(style: base, children: _spansForNodes(context, nodes, base)),
    );
  }

  List<InlineSpan> _spansForNodes(
    BuildContext context,
    List<md.Node> nodes,
    TextStyle base,
  ) {
    return nodes
        .map((node) => _spanForNode(context, node, base))
        .toList(growable: false);
  }

  InlineSpan _spanForNode(BuildContext context, md.Node node, TextStyle base) {
    if (node is md.Text) {
      return TextSpan(text: node.text);
    }
    if (node is! md.Element) {
      return const TextSpan(text: '');
    }
    final children = _spansForNodes(
      context,
      node.children ?? const <md.Node>[],
      base,
    );
    return switch (node.tag) {
      'strong' => TextSpan(
        style: base.copyWith(fontWeight: FontWeight.w700),
        children: children,
      ),
      'em' => TextSpan(
        style: base.copyWith(fontStyle: FontStyle.italic),
        children: children,
      ),
      'code' => TextSpan(
        style: base.copyWith(
          fontFamily: 'monospace',
          backgroundColor: resolveChatColor(
            context,
            CupertinoColors.tertiarySystemGroupedBackground,
          ),
        ),
        text: node.textContent,
      ),
      'a' => TextSpan(
        style: base.copyWith(
          color: CupertinoTheme.of(context).primaryColor,
          decoration: TextDecoration.underline,
        ),
        children: children,
      ),
      'li' => TextSpan(text: '• ${node.textContent}\n'),
      _ => TextSpan(children: children),
    };
  }
}
