import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';
import 'package:flutter_chat_view/src/model/transport_protocol.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visibility_detector/visibility_detector.dart';

void main() {
  group('Feature: transcript latest affordance', () {
    testWidgets(
      'Scenario: Given a scrolled transcript When latest is tapped Then the control remains lifecycle-safe',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          VisibilityDetectorController.instance.updateInterval = Duration.zero;
          addTearDown(() {
            VisibilityDetectorController.instance.updateInterval =
                const Duration(milliseconds: 500);
          });
          tester.view.devicePixelRatio = 1;
          tester.view.physicalSize = const Size(390, 720);
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);

          final session = _ReadyRoomTransportSession();
          final controller = ChatViewController(
            transportUrl: 'ws://example.com/room/room-demo',
            transportClient: _FakeRoomTransportClient(session),
          );
          addTearDown(controller.dispose);
          await controller.connect();
          session.emitSnapshot(_messages(count: 56));

          await tester.pumpWidget(
            CupertinoApp(
              home: CupertinoPageScaffold(
                child: SafeArea(child: FlutterChatView(controller: controller)),
              ),
            ),
          );
          await tester.pumpAndSettle();

          await tester.drag(find.byType(ListView), const Offset(0, -420));
          await tester.pumpAndSettle();
          expect(find.text('Latest'), findsOneWidget);

          await tester.tap(find.text('Latest'));
          await tester.pump();
          await tester.pumpAndSettle();

          expect(find.text('Latest'), findsOneWidget);
          expect(tester.takeException(), isNull);
        } finally {
          semantics.dispose();
        }
      },
    );
  });
}

class _FakeRoomTransportClient implements RoomTransportClient {
  const _FakeRoomTransportClient(this.session);

  final _ReadyRoomTransportSession session;

  @override
  RoomTransportSession connect(Uri uri) => session;
}

class _ReadyRoomTransportSession implements RoomTransportSession {
  final StreamController<ChatTransportEvent> _events =
      StreamController<ChatTransportEvent>(sync: true);
  final List<String> sentFrames = <String>[];

  @override
  Stream<ChatTransportEvent> get events => _events.stream;

  @override
  Future<void> get ready => Future<void>.value();

  @override
  void send(String frame) => sentFrames.add(frame);

  void emitSnapshot(List<ChatMessage> messages) {
    _events.add(
      ChatSnapshotEvent(
        channel: const ChatChannel(
          chatId: 'room-demo',
          kind: 'room',
          title: 'Room Demo',
          owner: 'owner',
          participants: <ChatParticipant>[
            ChatParticipant(id: 'agent', label: 'Agent'),
            ChatParticipant(id: 'operator', label: 'Operator'),
          ],
          accessToken: 'msgtok_demo',
          transportUrl: 'ws://example.com/room/room-demo',
          participantId: 'operator',
        ),
        items: messages,
        hasMoreBefore: false,
      ),
    );
  }

  @override
  Future<void> close() => _events.close();
}

List<ChatMessage> _messages({required int count}) {
  return List<ChatMessage>.generate(count, (index) {
    final rowId = index + 1;
    return ChatMessage(
      viewKey: 'msg-$rowId',
      rowId: rowId,
      messageId: rowId,
      chatId: 'room-demo',
      senderActorId: index.isEven ? 'agent' : 'operator',
      from: index.isEven ? 'Agent' : 'Operator',
      kind: ChatMessageKind.text,
      content:
          'Message $rowId keeps enough body text to create a real transcript '
          'scroll surface and exercise return-to-latest motion safely.',
      createdAt: rowId * 1000,
      updatedAt: rowId * 1000,
      readActorIds: const <String>[],
      unreadActorIds: const <String>[],
    );
  });
}
