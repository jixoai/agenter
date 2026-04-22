import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view_demo/app/controller/product_shell_controller.dart';
import 'package:flutter_chat_view_demo/app/model/connection_profile.dart';
import 'package:flutter_chat_view_demo/app/store/connection_profile_store.dart';

void main() {
  group('Feature: product shell profile lifecycle', () {
    test(
      'Scenario: Given a share link bootstrap When initializing controller Then the imported profile becomes active without reconnect glue',
      () async {
        final controller = ProductShellController(
          store: MemoryConnectionProfileStore(),
          connectOnActivate: false,
        );

        await controller.initialize(
          Uri.parse(
            'http://localhost:4107/?url=ws://127.0.0.1:4600/room/room-demo&token=msgtok_demo',
          ),
        );

        expect(controller.profiles.length, 1);
        expect(
          controller.activeProfile?.transportUrl,
          contains('/room/room-demo'),
        );
        expect(controller.activeProfile?.accessToken, 'msgtok_demo');
      },
    );

    test(
      'Scenario: Given saved profiles When saving and deleting Then the active shell profile stays durable and editable',
      () async {
        final store = MemoryConnectionProfileStore();
        final controller = ProductShellController(
          store: store,
          connectOnActivate: false,
        );
        await controller.initialize(Uri.parse('http://localhost:4107/'));

        await controller.saveProfile(
          const ConnectionProfileDraft(
            name: 'Primary room',
            transportUrl: 'ws://127.0.0.1:4600/room/room-primary',
            accessToken: 'msgtok_primary',
          ),
        );
        await controller.saveProfile(
          const ConnectionProfileDraft(
            name: 'Backup room',
            transportUrl: 'ws://127.0.0.1:4600/room/room-backup',
            accessToken: 'msgtok_backup',
          ),
        );

        expect(controller.profiles.length, 2);
        expect(controller.activeProfile?.displayName, 'Backup room');

        await controller.deleteProfile(controller.activeProfileId!);

        expect(controller.profiles.length, 1);
        expect(controller.activeProfile?.displayName, 'Primary room');
      },
    );
  });
}
