import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/src/widgets/chat_markdown_view.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Feature: transcript markdown rendering', () {
    testWidgets(
      'Scenario: Given markdown content When rendered in transcript Then no selectable platform-view region is mounted',
      (tester) async {
        await tester.pumpWidget(
          const CupertinoApp(
            home: CupertinoPageScaffold(
              child: ChatMarkdownView(
                markdown: '''
Plain paragraph.

```txt
code block
```
''',
              ),
            ),
          ),
        );

        expect(find.textContaining('Plain paragraph'), findsOneWidget);
        expect(find.byType(SelectableRegion), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  });
}
