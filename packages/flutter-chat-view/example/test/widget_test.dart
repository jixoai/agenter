import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';
import 'package:flutter_chat_view_demo/app/l10n/product_shell_localizations.dart';
import 'package:flutter_chat_view_demo/app/model/connection_profile.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_chat_view_demo/app/store/connection_profile_store.dart';
import 'package:flutter_chat_view_demo/app/widget/apple_platform_theme.dart';
import 'package:flutter_chat_view_demo/app/widget/apple_sections.dart';
import 'package:flutter_chat_view_demo/app/widget/apple_surfaces.dart';
import 'package:flutter_chat_view_demo/app/widget/compact_route_sheet.dart';
import 'package:flutter_chat_view_demo/app/widget/detail_rail.dart';
import 'package:flutter_chat_view_demo/app/widget/product_shell_app.dart';

void setTestViewport(WidgetTester tester, Size size) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  Future<void> expectCompactProductShell(WidgetTester tester, Size size) async {
    setTestViewport(tester, size);

    await tester.pumpWidget(
      ProductShellApp(
        store: MemoryConnectionProfileStore(),
        bootstrapUri: Uri.parse('http://localhost:4107/'),
        connectOnActivate: false,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Agenter Chat'), findsWidgets);
    expect(find.bySemanticsLabel('Profiles'), findsOneWidget);
    expect(find.byType(CupertinoTabBar), findsNothing);
    expect(find.text('Chat'), findsNothing);
    expect(find.text('Details'), findsNothing);
    expect(find.text('No Room Open'), findsOneWidget);
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(tester.takeException(), isNull);
  }

  Future<void> expectDesktopProductShell(WidgetTester tester, Size size) async {
    setTestViewport(tester, size);

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
    expect(find.text('No Room Open'), findsOneWidget);
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
    setTestViewport(tester, size);

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
    expect(find.text('No Room Open'), findsOneWidget);
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(find.text('Import url + token'), findsAtLeastNWidgets(1));
    expect(find.text('Chat'), findsNothing);
    expect(tester.takeException(), isNull);
  }

  Future<void> expectImportedProfileShell(
    WidgetTester tester,
    Size size,
  ) async {
    setTestViewport(tester, size);

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
    'Feature: Apple shell rhythm Scenario: Given compact iPhone viewport When shell renders Then active route is edge-to-edge without a rounded content card',
    (tester) async {
      setTestViewport(tester, const Size(390, 844));

      await tester.pumpWidget(
        ProductShellApp(
          store: MemoryConnectionProfileStore(),
          bootstrapUri: Uri.parse('http://localhost:4107/'),
          connectOnActivate: false,
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is AppleMaterialSurface &&
              widget.role == AppleSurfaceRole.content,
        ),
        findsNothing,
      );
      expect(find.byType(IndexedStack), findsNothing);
      expect(find.byType(CupertinoTabBar), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Feature: Apple shell rhythm Scenario: Given desktop viewport When shell renders Then margins and gaps come from platform tokens',
    (tester) async {
      setTestViewport(tester, const Size(1400, 900));

      await tester.pumpWidget(
        ProductShellApp(
          store: MemoryConnectionProfileStore(),
          bootstrapUri: Uri.parse('http://localhost:4107/'),
          connectOnActivate: false,
        ),
      );
      await tester.pumpAndSettle();

      final context = tester.element(find.text('No Room Open').first);
      expect(appleTokens(context).columnGap, 1);
      expect(appleShellMargins(context), EdgeInsets.zero);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is AppleMaterialSurface &&
              widget.role == AppleSurfaceRole.content,
        ),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Feature: Apple section rhythm Scenario: Given product shell renders When profile and detail panels appear Then section primitives own grouped spacing',
    (tester) async {
      setTestViewport(tester, const Size(1400, 900));

      await tester.pumpWidget(
        ProductShellApp(
          store: MemoryConnectionProfileStore(),
          bootstrapUri: Uri.parse('http://localhost:4107/'),
          connectOnActivate: false,
        ),
      );
      await tester.pumpAndSettle();

      final context = tester.element(find.text('No Room Open').first);
      expect(appleTokens(context).sectionGap, 10);
      expect(
        appleTokens(context).sectionBodyPadding,
        const EdgeInsets.fromLTRB(20, 16, 20, 18),
      );
      expect(find.byType(AppleSection), findsAtLeastNWidgets(2));
      expect(find.byType(ApplePanelGap), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    },
  );

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
        expect(find.bySemanticsLabel('Show details'), findsOneWidget);
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

  testWidgets(
    'Feature: conversation-first compact routing Scenario: Given compact shell When profile directory opens Then it appears as a secondary sheet without bottom nav',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        setTestViewport(tester, const Size(390, 844));

        await tester.pumpWidget(
          ProductShellApp(
            store: MemoryConnectionProfileStore(),
            bootstrapUri: Uri.parse('http://localhost:4107/'),
            connectOnActivate: false,
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.bySemanticsLabel('Profiles'));
        await tester.pumpAndSettle();

        expect(find.byType(CupertinoTabBar), findsNothing);
        expect(
          tester
              .widget<CompactRouteSheet>(find.byType(CompactRouteSheet))
              .detent,
          CompactRouteSheetDetent.page,
        );
        expect(find.text('Profiles'), findsWidgets);
        expect(find.text('No saved room profiles'), findsOneWidget);
        expect(find.bySemanticsLabel('Close'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'Feature: conversation-first compact routing Scenario: Given compact active profile When details opens Then room facts appear as an inspector sheet',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        setTestViewport(tester, const Size(390, 844));

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

        await tester.tap(find.bySemanticsLabel('Show details'));
        await tester.pumpAndSettle();

        expect(find.byType(CupertinoTabBar), findsNothing);
        expect(
          tester
              .widget<CompactRouteSheet>(find.byType(CompactRouteSheet))
              .detent,
          CompactRouteSheetDetent.inspector,
        );
        expect(find.text('Details'), findsWidgets);
        expect(find.text('Copy share link'), findsOneWidget);
        expect(find.bySemanticsLabel('Close'), findsOneWidget);
        expect(tester.takeException(), isNull);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'Feature: Web transcript stability Scenario: Given a selected message detail rail When rendered Then no selectable platform-view region is mounted',
    (tester) async {
      setTestViewport(tester, const Size(1400, 900));
      final controller = ChatViewController(
        transportUrl: 'ws://127.0.0.1:4600/room/room-demo',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        CupertinoApp(
          theme: buildApplePlatformTheme(),
          localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
            ProductShellLocalizations.delegate,
            ChatViewLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const <Locale>[
            Locale('en'),
            Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hans'),
          ],
          home: CupertinoPageScaffold(
            child: DetailRail(
              activeProfile: const ConnectionProfile(
                id: 'room-demo',
                name: 'Room demo',
                transportUrl: 'ws://127.0.0.1:4600/room/room-demo',
                accessToken: 'msgtok_demo',
                createdAt: 0,
                updatedAt: 0,
              ),
              chatController: controller,
              selectedMessage: const ChatMessage(
                viewKey: 'row-1',
                rowId: 1,
                messageId: 1,
                chatId: 'room-demo',
                from: 'Assistant',
                kind: ChatMessageKind.text,
                content: 'Copyable detail text',
                createdAt: 0,
                updatedAt: 0,
                readActorIds: <String>[],
                unreadActorIds: <String>[],
              ),
              onCopyShareLink: () {},
              onClearSelectedMessage: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Copyable detail text'), findsOneWidget);
      expect(find.text('Copy text'), findsOneWidget);
      expect(find.byType(SelectableRegion), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
