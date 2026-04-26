import 'dart:async';
import 'dart:convert';

import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';
import 'package:flutter_chat_view/src/model/transport_protocol.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:visibility_detector/visibility_detector.dart';

void main() {
  group('Feature: transcript latest affordance', () {
    testWidgets(
      'Scenario: Given a non-empty transcript When the chat stage opens Then latest messages are visible',
      (tester) async {
        await _withChatHarness(tester, (harness) async {
          harness.session.emitSnapshot(_messages(count: 72));

          await harness.pump();

          final position = _transcriptPosition(tester);
          expect(position.pixels, moreOrLessEquals(position.maxScrollExtent));
          expect(find.textContaining('Message 72'), findsWidgets);
        });
      },
    );

    testWidgets(
      'Scenario: Given older history exists When the operator scrolls upward Then one canonical page request is sent',
      (tester) async {
        await _withChatHarness(tester, (harness) async {
          final before = const ReverseCursor(beforeTimeMs: 41000, beforeId: 41);
          harness.session.emitSnapshot(
            _messages(count: 60, startRowId: 41),
            hasMoreBefore: true,
            nextBefore: before,
          );
          harness.session.sentFrames.clear();

          await harness.pump();

          await _dragTranscriptTowardTop(tester);

          final pageFrames = _pageFrames(harness.session.sentFrames);
          expect(pageFrames, hasLength(1));
          final payload = jsonDecode(pageFrames.single) as Map<String, Object?>;
          expect(payload['type'], 'page');
          expect(payload['limit'], 60);
          expect(payload['before'], <String, Object?>{
            'beforeTimeMs': before.beforeTimeMs,
            'beforeId': before.beforeId,
          });

          await tester.drag(find.byType(ListView), const Offset(0, 800));
          await tester.pump(const Duration(milliseconds: 16));

          expect(_pageFrames(harness.session.sentFrames), hasLength(1));
        });
      },
    );

    testWidgets(
      'Scenario: Given older messages are prepended When the page merges Then the visible reading anchor is preserved',
      (tester) async {
        await _withChatHarness(tester, (harness) async {
          harness.session.emitSnapshot(
            _messages(count: 60, startRowId: 41),
            hasMoreBefore: true,
            nextBefore: const ReverseCursor(beforeTimeMs: 41000, beforeId: 41),
          );
          harness.session.sentFrames.clear();

          await harness.pump();
          await _dragTranscriptTowardTop(tester);

          expect(find.textContaining('Message 41'), findsWidgets);
          harness.session.emitPage(_messages(count: 40), hasMoreBefore: false);
          await tester.pumpAndSettle();

          expect(find.textContaining('Message 41'), findsWidgets);
        });
      },
    );

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

          await _dragTranscriptTowardTop(tester);
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

Future<void> _withChatHarness(
  WidgetTester tester,
  Future<void> Function(_ChatHarness harness) body,
) async {
  final semantics = tester.ensureSemantics();
  try {
    VisibilityDetectorController.instance.updateInterval = Duration.zero;
    addTearDown(() {
      VisibilityDetectorController.instance.updateInterval = const Duration(
        milliseconds: 500,
      );
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
    await body(
      _ChatHarness(tester: tester, session: session, controller: controller),
    );
  } finally {
    semantics.dispose();
  }
}

ScrollPosition _transcriptPosition(WidgetTester tester) =>
    tester.widget<ListView>(find.byType(ListView)).controller!.position;

List<String> _pageFrames(List<String> frames) =>
    frames.where((frame) => frame.contains('"type":"page"')).toList();

Future<void> _dragTranscriptTowardTop(WidgetTester tester) async {
  for (var attempt = 0; attempt < 16; attempt += 1) {
    final position = _transcriptPosition(tester);
    if (position.pixels <= 96) {
      break;
    }
    await tester.drag(find.byType(ListView), const Offset(0, 900));
    await tester.pump(const Duration(milliseconds: 16));
  }
  await tester.pump(const Duration(milliseconds: 80));
}

class _ChatHarness {
  const _ChatHarness({
    required this.tester,
    required this.session,
    required this.controller,
  });

  final WidgetTester tester;
  final _ReadyRoomTransportSession session;
  final ChatViewController controller;

  Future<void> pump() async {
    await tester.pumpWidget(
      CupertinoApp(
        home: CupertinoPageScaffold(
          child: SafeArea(child: FlutterChatView(controller: controller)),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }
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

  void emitSnapshot(
    List<ChatMessage> messages, {
    bool hasMoreBefore = false,
    ReverseCursor? nextBefore,
  }) {
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
        hasMoreBefore: hasMoreBefore,
        nextBefore: nextBefore,
      ),
    );
  }

  void emitPage(
    List<ChatMessage> messages, {
    required bool hasMoreBefore,
    ReverseCursor? nextBefore,
  }) {
    _events.add(
      ChatPageEvent(
        items: messages,
        hasMoreBefore: hasMoreBefore,
        nextBefore: nextBefore,
      ),
    );
  }

  @override
  Future<void> close() => _events.close();
}

List<ChatMessage> _messages({required int count, int startRowId = 1}) {
  return List<ChatMessage>.generate(count, (index) {
    final rowId = startRowId + index;
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
