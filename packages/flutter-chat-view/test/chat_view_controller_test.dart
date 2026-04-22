import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_chat_view/src/controller/chat_view_controller.dart';
import 'package:flutter_chat_view/src/model/chat_view_state.dart';
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
