import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/plugin/composer_plugin.dart';

void main() {
  group('Feature: composer trigger detection', () {
    test(
      'Scenario: Given cursor on a mention token When scanning composer text Then the @ token range and query are returned',
      () {
        final token = findComposerToken(
          value: 'hello @workspace/rea',
          cursor: 'hello @workspace/rea'.length,
          triggers: {'@', '/', r'$'},
        );

        expect(token?.trigger, '@');
        expect(token?.query, 'workspace/rea');
        expect(token?.raw, '@workspace/rea');
      },
    );

    test(
      'Scenario: Given cursor inside plain text When scanning composer text Then no trigger token is emitted',
      () {
        final token = findComposerToken(
          value: 'plain text only',
          cursor: 'plain text'.length,
          triggers: {'@', '/', r'$'},
        );

        expect(token, isNull);
      },
    );
  });
}
