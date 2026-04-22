import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view_demo/app/store/connection_profile_store.dart';
import 'package:flutter_chat_view_demo/app/widget/product_shell_app.dart';

void main() {
  Future<void> expectCompactProductShell(WidgetTester tester, Size size) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProductShellApp(
        store: MemoryConnectionProfileStore(),
        bootstrapUri: Uri.parse('http://localhost:4107/'),
        connectOnActivate: false,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Agenter Chat'), findsWidgets);
    expect(find.text('Profiles'), findsOneWidget);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Details'), findsOneWidget);
    expect(find.text('Conversation-first room stage'), findsOneWidget);
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(tester.takeException(), isNull);
  }

  Future<void> expectDesktopProductShell(WidgetTester tester, Size size) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProductShellApp(
        store: MemoryConnectionProfileStore(),
        bootstrapUri: Uri.parse('http://localhost:4107/'),
        connectOnActivate: false,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Agenter Chat'), findsWidgets);
    expect(find.text('Profiles'), findsOneWidget);
    expect(find.text('Conversation-first room stage'), findsOneWidget);
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(
      find.textContaining(
        'Room detail surfaces appear here once a profile is active.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  }

  Future<void> expectStandardProductShell(
    WidgetTester tester,
    Size size,
  ) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProductShellApp(
        store: MemoryConnectionProfileStore(),
        bootstrapUri: Uri.parse('http://localhost:4107/'),
        connectOnActivate: false,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Agenter Chat'), findsWidgets);
    expect(find.text('Profiles'), findsOneWidget);
    expect(find.text('Conversation-first room stage'), findsOneWidget);
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(
      find.textContaining(
        'Room detail surfaces appear here once a profile is active.',
      ),
      findsOneWidget,
    );
    expect(find.text('Chat'), findsNothing);
    expect(tester.takeException(), isNull);
  }

  Future<void> expectImportedProfileShell(
    WidgetTester tester,
    Size size,
  ) async {
    await tester.binding.setSurfaceSize(size);
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProductShellApp(
        store: MemoryConnectionProfileStore(),
        bootstrapUri: Uri.parse(
          'http://localhost:4107/?url=ws://127.0.0.1:4600/room/room-demo&token=msgtok_demo',
        ),
        connectOnActivate: false,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('room-demo'), findsWidgets);
    expect(find.text('Copy share link'), findsOneWidget);
    expect(find.widgetWithText(CupertinoButton, 'Connect'), findsOneWidget);
    expect(tester.takeException(), isNull);
  }

  testWidgets('renders the product shell on a compact viewport', (
    tester,
  ) async {
    await expectCompactProductShell(tester, const Size(390, 844));
  });

  testWidgets('renders the product shell on a desktop viewport', (
    tester,
  ) async {
    await expectDesktopProductShell(tester, const Size(1400, 900));
  });

  testWidgets('renders the product shell on a standard viewport', (
    tester,
  ) async {
    await expectStandardProductShell(tester, const Size(960, 900));
  });

  testWidgets(
    'hydrates an imported room profile into the desktop product shell',
    (tester) async {
      await expectImportedProfileShell(tester, const Size(1400, 900));
    },
  );

  testWidgets(
    'compact imported shell keeps the new-profile icon action labeled and touch-sized',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await tester.pumpWidget(
          ProductShellApp(
            store: MemoryConnectionProfileStore(),
            bootstrapUri: Uri.parse(
              'http://localhost:4107/?url=ws://127.0.0.1:4600/room/room-demo&token=msgtok_demo',
            ),
            connectOnActivate: false,
          ),
        );
        await tester.pumpAndSettle();

        expect(find.bySemanticsLabel('New profile'), findsOneWidget);
        expect(find.widgetWithText(CupertinoButton, 'Connect'), findsOneWidget);
        expect(
          tester.getSize(
            find.ancestor(
              of: find.byIcon(CupertinoIcons.add_circled),
              matching: find.byType(CupertinoButton),
            ),
          ),
          const Size(44, 44),
        );
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );
}
