import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/controller/chat_view_controller.dart';
import 'package:flutter_chat_view/src/model/chat_models.dart';
import 'package:flutter_chat_view/src/plugin/composer_plugin.dart';
import 'package:flutter_chat_view/src/widgets/chat_composer.dart';

void main() {
  group('Feature: compact composer actions', () {
    testWidgets(
      'Scenario: Given a narrow viewport When the composer is idle Then attach and send actions remain visible',
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

        expect(find.byIcon(CupertinoIcons.paperclip), findsOneWidget);
        expect(
          find.byIcon(CupertinoIcons.arrow_up_circle_fill),
          findsOneWidget,
        );
        expect(
          tester.getSize(find.byType(CupertinoButton).first),
          const Size(48, 48),
        );
        expect(tester.takeException(), isNull);
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
