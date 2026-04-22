import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/util/transport_urls.dart';

void main() {
  group('Feature: transport URL derivation', () {
    test(
      'Scenario: Given a websocket room URL When overriding token Then the resolved URL keeps room path and replaces the token query',
      () {
        final uri = resolveTransportUri(
          transportUrl: 'ws://127.0.0.1:4600/room/room-demo?token=old',
          accessToken: 'msgtok_new',
        );

        expect(
          uri.toString(),
          'ws://127.0.0.1:4600/room/room-demo?token=msgtok_new',
        );
      },
    );

    test(
      'Scenario: Given a websocket room URL When deriving HTTP base and room id Then uploads can target the room asset API without extra config',
      () {
        final transport = Uri.parse(
          'wss://chat.example.dev/room/room-42?token=msgtok_room',
        );

        expect(
          deriveHttpBaseUri(transport).toString(),
          'https://chat.example.dev',
        );
        expect(extractChatId(transport), 'room-42');
      },
    );
  });
}
