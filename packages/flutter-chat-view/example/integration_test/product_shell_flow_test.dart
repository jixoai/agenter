import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view_demo/app/store/connection_profile_store.dart';
import 'package:flutter_chat_view_demo/app/widget/product_shell_app.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'Scenario: Given a new product shell When a profile is created Then the imported room becomes the active room shell',
    (tester) async {
      await tester.pumpWidget(
        ProductShellApp(
          store: MemoryConnectionProfileStore(),
          bootstrapUri: Uri.parse('http://localhost:4107/'),
          connectOnActivate: false,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.widgetWithText(CupertinoButton, 'New profile').first,
      );
      await tester.pumpAndSettle();

      final fields = find.byType(CupertinoTextField);
      await tester.enterText(fields.at(0), 'Primary room');
      await tester.enterText(
        fields.at(1),
        'ws://127.0.0.1:4600/room/room-primary',
      );
      await tester.enterText(fields.at(2), 'msgtok_primary');

      await tester.tap(find.widgetWithText(CupertinoButton, 'Create profile'));
      await tester.pumpAndSettle();

      expect(find.text('Primary room'), findsWidgets);
      expect(find.widgetWithText(CupertinoButton, 'Connect'), findsOneWidget);
    },
  );
}
