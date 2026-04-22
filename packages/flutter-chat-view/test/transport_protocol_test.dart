import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/model/chat_models.dart';
import 'package:flutter_chat_view/src/model/transport_protocol.dart';

void main() {
  group('Feature: transport payload decoding', () {
    test(
      'Scenario: Given a snapshot transport event When decoding it Then channel state and reverse paging facts hydrate together',
      () {
        final event = parseTransportEvent('''
{
  "type": "snapshot",
  "chatId": "room-demo",
  "snapshot": {
    "channel": {
      "chatId": "room-demo",
      "kind": "room",
      "title": "Demo room",
      "owner": "owner-1",
      "participants": [{"id":"auth:viewer","label":"Viewer"}],
      "accessToken": "msgtok_demo",
      "transportUrl": "ws://127.0.0.1:4600/room/room-demo?token=msgtok_demo",
      "participantId": "auth:viewer"
    },
    "items": [{
      "rowId": 12,
      "messageId": 8,
      "chatId": "room-demo",
      "from": "Viewer",
      "kind": "text",
      "content": "hello",
      "createdAt": 100,
      "updatedAt": 100,
      "readActorIds": ["auth:viewer"],
      "unreadActorIds": []
    }],
    "nextBefore": {"beforeTimeMs": 50, "beforeId": 7},
    "hasMoreBefore": true
  }
}
''');

        expect(event, isA<ChatSnapshotEvent>());
        final snapshot = event as ChatSnapshotEvent;
        expect(snapshot.channel.chatId, 'room-demo');
        expect(snapshot.channel.participantId, 'auth:viewer');
        expect(snapshot.items.single.kind, ChatMessageKind.text);
        expect(snapshot.nextBefore?.beforeId, 7);
        expect(snapshot.hasMoreBefore, isTrue);
      },
    );

    test(
      'Scenario: Given a messages delta with recalled content When decoding it Then recalled state stays objective',
      () {
        final event = parseTransportEvent('''
{
  "type": "messages",
  "chatId": "room-demo",
  "items": [{
    "rowId": 15,
    "messageId": 9,
    "chatId": "room-demo",
    "from": "Viewer",
    "kind": "text",
    "content": "stale body",
    "createdAt": 110,
    "updatedAt": 120,
    "recalledAt": 121,
    "readActorIds": [],
    "unreadActorIds": ["auth:viewer"]
  }],
  "headVersion": "2"
}
''');

        final delta = event as ChatMessagesEvent;
        expect(delta.items.single.isRecalled, isTrue);
        expect(delta.items.single.content, 'stale body');
      },
    );
  });
}
