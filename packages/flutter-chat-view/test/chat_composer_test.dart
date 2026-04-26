import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/controller/chat_view_controller.dart';
import 'package:flutter_chat_view/src/model/chat_models.dart';
import 'package:flutter_chat_view/src/plugin/composer_plugin.dart';
import 'package:flutter_chat_view/src/widgets/chat_composer.dart';
import 'package:flutter_chat_view/src/widgets/chat_surface_theme.dart';

void main() {
  group('Feature: compact composer actions', () {
    testWidgets(
      'Scenario: Given a narrow viewport When the composer is idle Then attach and send actions remain visible',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          final controller = ChatViewController(
            transportUrl: 'ws://example.com/room/room-demo',
          );
          addTearDown(controller.dispose);
          await tester.binding.setSurfaceSize(const Size(390, 844));
          addTearDown(() => tester.binding.setSurfaceSize(null));

          await tester.pumpWidget(
            CupertinoApp(
              home: CupertinoPageScaffold(
                child: SafeArea(
                  child: ChatComposer(
                    controller: controller,
                    plugins: const <ChatComposerPlugin>[],
                    editingMessage: null,
                    onEditingMessageChanged: (_) {},
                  ),
                ),
              ),
            ),
          );
          await tester.pump();

          expect(find.byIcon(CupertinoIcons.paperclip), findsOneWidget);
          expect(find.bySemanticsLabel('Attach files'), findsOneWidget);
          expect(
            find.byIcon(CupertinoIcons.arrow_up_circle_fill),
            findsOneWidget,
          );
          expect(find.bySemanticsLabel('Send'), findsOneWidget);
          expect(
            tester.getSize(find.byType(CupertinoButton).first),
            const Size(48, 48),
          );
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );

    testWidgets(
      'Scenario: Given a narrow viewport When the composer is editing Then cancel and save actions remain visible',
      (tester) async {
        final controller = ChatViewController(
          transportUrl: 'ws://example.com/room/room-demo',
        );
        addTearDown(controller.dispose);
        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await tester.pumpWidget(
          CupertinoApp(
            home: CupertinoPageScaffold(
              child: SafeArea(
                child: ChatComposer(
                  controller: controller,
                  plugins: const <ChatComposerPlugin>[],
                  editingMessage: _editingMessage(),
                  onEditingMessageChanged: (_) {},
                ),
              ),
            ),
          ),
        );
        await tester.pump();

        expect(find.byIcon(CupertinoIcons.clear_circled_solid), findsOneWidget);
        expect(
          find.byIcon(CupertinoIcons.check_mark_circled_solid),
          findsOneWidget,
        );
        expect(
          tester.getSize(find.byType(CupertinoButton).first),
          const Size(48, 48),
        );
        expect(tester.takeException(), isNull);
      },
    );
  });

  group('Feature: Apple chat rhythm tokens', () {
    testWidgets(
      'Scenario: Given chat composer renders When action sizes are inspected Then chat rhythm tokens own the touch target and spacing',
      (tester) async {
        final controller = ChatViewController(
          transportUrl: 'ws://example.com/room/room-demo',
        );
        addTearDown(controller.dispose);
        await tester.binding.setSurfaceSize(const Size(390, 844));
        addTearDown(() => tester.binding.setSurfaceSize(null));

        await tester.pumpWidget(
          CupertinoApp(
            home: CupertinoPageScaffold(
              child: SafeArea(
                child: ChatComposer(
                  controller: controller,
                  plugins: const <ChatComposerPlugin>[],
                  editingMessage: null,
                  onEditingMessageChanged: (_) {},
                ),
              ),
            ),
          ),
        );
        await tester.pump();

        final context = tester.element(find.byType(ChatComposer));
        expect(chatTokens(context).composerActionSize, 48);
        expect(
          chatTokens(context).composerBarPadding,
          const EdgeInsets.fromLTRB(12, 10, 12, 10),
        );
        expect(
          tester.getSize(find.byType(CupertinoButton).first),
          Size.square(chatTokens(context).composerActionSize),
        );
        expect(chatTokens(context).transcriptPadding, const EdgeInsets.all(16));
        expect(chatTokens(context).noticeRadius, 20);
        expect(chatTokens(context).latestVisibilityDistance, 240);
        expect(tester.takeException(), isNull);
      },
    );
  });
}

ChatMessage _editingMessage() {
  return ChatMessage(
    viewKey: 'msg-1',
    rowId: 1,
    messageId: 1,
    chatId: 'room-demo',
    from: 'Tester',
    kind: ChatMessageKind.text,
    content: 'draft',
    createdAt: 1,
    updatedAt: 1,
    readActorIds: const <String>[],
    unreadActorIds: const <String>[],
  );
}
