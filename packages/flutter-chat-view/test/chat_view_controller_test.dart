import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cross_file/cross_file.dart';
import 'package:flutter_chat_view/src/controller/chat_view_controller.dart';
import 'package:flutter_chat_view/src/model/chat_models.dart';
import 'package:flutter_chat_view/src/model/chat_view_state.dart';
import 'package:flutter_chat_view/src/model/transport_protocol.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stream_channel/stream_channel.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() {
  group('Feature: connection timeout containment', () {
    test(
      'Scenario: Given a websocket that never becomes ready When connecting Then the controller converges into an error state instead of infinite loading',
      () async {
        final controller = ChatViewController(
          transportUrl: 'ws://example.com/room/room-demo',
          socketFactory: (_) => _NeverReadyWebSocketChannel(),
          connectionTimeout: const Duration(milliseconds: 1),
        );
        addTearDown(controller.dispose);

        await controller.connect();

        expect(controller.state.connectionState, ChatViewConnectionState.error);
        expect(controller.state.loadingInitial, isFalse);
        expect(controller.state.errorMessage, contains('timed out'));
      },
    );
  });

  group('Feature: adapter-backed chat controller', () {
    test(
      'Scenario: Given an injected room transport When connecting Then focus is sent through the transport boundary',
      () async {
        final session = _ReadyRoomTransportSession();
        final controller = ChatViewController(
          transportUrl: 'ws://example.com/room/room-demo',
          transportClient: _FakeRoomTransportClient(session),
        );
        addTearDown(controller.dispose);

        await controller.connect();

        expect(
          controller.state.connectionState,
          ChatViewConnectionState.connected,
        );
        expect(session.sentFrames.single, contains('"type":"focus"'));
      },
    );

    test(
      'Scenario: Given an injected uploader When sending attachments Then upload metadata is sent through the transport boundary',
      () async {
        final session = _ReadyRoomTransportSession();
        final uploader = _FakeRoomAssetUploader();
        final controller = ChatViewController(
          transportUrl: 'ws://example.com/room/room-demo?token=msgtok_demo',
          accessToken: 'msgtok_override',
          transportClient: _FakeRoomTransportClient(session),
          assetUploader: uploader,
        );
        addTearDown(controller.dispose);
        await controller.connect();
        session.sentFrames.clear();

        await controller.sendText(
          'hello',
          attachments: [_FakeXFile('demo.txt')],
        );

        expect(uploader.uploadedChatId, 'room-demo');
        expect(uploader.uploadedAccessToken, 'msgtok_override');
        expect(session.sentFrames.single, contains('"type":"send"'));
        expect(session.sentFrames.single, contains('asset-demo'));
      },
    );
  });
}

class _NeverReadyWebSocketChannel
    with StreamChannelMixin<Object?>
    implements WebSocketChannel {
  _NeverReadyWebSocketChannel() : this._(StreamController<Object?>());

  _NeverReadyWebSocketChannel._(this._streamController)
    : _ready = Completer<void>(),
      _sink = _NeverReadyWebSocketSink(_streamController);

  final StreamController<Object?> _streamController;
  final Completer<void> _ready;
  final _NeverReadyWebSocketSink _sink;

  @override
  int? get closeCode => null;

  @override
  String? get closeReason => null;

  @override
  String? get protocol => null;

  @override
  Future<void> get ready => _ready.future;

  @override
  WebSocketSink get sink => _sink;

  @override
  Stream<Object?> get stream => _streamController.stream;
}

class _NeverReadyWebSocketSink implements WebSocketSink {
  _NeverReadyWebSocketSink(this._streamController);

  final StreamController<Object?> _streamController;

  @override
  void add(event) {}

  @override
  Future<void> addStream(Stream stream) async {}

  @override
  void addError(Object error, [StackTrace? stackTrace]) {}

  @override
  Future<void> close([int? closeCode, String? closeReason]) async {
    await _streamController.close();
  }

  @override
  Future<void> get done => Future<void>.value();
}

class _FakeRoomTransportClient implements RoomTransportClient {
  const _FakeRoomTransportClient(this.session);

  final _ReadyRoomTransportSession session;

  @override
  RoomTransportSession connect(Uri uri) => session;
}

class _ReadyRoomTransportSession implements RoomTransportSession {
  final StreamController<ChatTransportEvent> _events =
      StreamController<ChatTransportEvent>();
  final List<String> sentFrames = <String>[];

  @override
  Stream<ChatTransportEvent> get events => _events.stream;

  @override
  Future<void> get ready => Future<void>.value();

  @override
  void send(String frame) => sentFrames.add(frame);

  @override
  Future<void> close() => _events.close();
}

class _FakeRoomAssetUploader implements RoomAssetUploader {
  String? uploadedChatId;
  String? uploadedAccessToken;

  @override
  Future<List<ChatAttachment>> upload({
    required Uri httpBaseUri,
    required String chatId,
    required String accessToken,
    required List<XFile> files,
  }) async {
    uploadedChatId = chatId;
    uploadedAccessToken = accessToken;
    return const <ChatAttachment>[
      ChatAttachment(
        assetId: 'asset-demo',
        kind: ChatAttachmentKind.file,
        name: 'demo.txt',
        mimeType: 'text/plain',
        sizeBytes: 4,
        url: '/assets/asset-demo',
      ),
    ];
  }
}

class _FakeXFile implements XFile {
  _FakeXFile(this.name);

  @override
  final String name;

  @override
  String? get mimeType => 'text/plain';

  @override
  String get path => name;

  @override
  Future<DateTime> lastModified() async =>
      DateTime.fromMillisecondsSinceEpoch(0);

  @override
  Future<int> length() async => 4;

  @override
  Future<String> readAsString({Encoding encoding = utf8}) async => 'demo';

  @override
  Future<Uint8List> readAsBytes() async =>
      Uint8List.fromList(<int>[1, 2, 3, 4]);

  @override
  Stream<Uint8List> openRead([int? start, int? end]) =>
      Stream<Uint8List>.value(Uint8List.fromList(<int>[1, 2, 3, 4]));

  @override
  Future<void> saveTo(String path) async {}
}
