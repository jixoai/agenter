import 'dart:async';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../model/transport_codec.dart';
import '../model/transport_protocol.dart';

abstract class RoomTransportSession {
  Stream<ChatTransportEvent> get events;
  Future<void> get ready;
  void send(String frame);
  Future<void> close();
}

abstract class RoomTransportClient {
  RoomTransportSession connect(Uri uri);
}

typedef WebSocketChannelFactory = WebSocketChannel Function(Uri uri);

class WebSocketRoomTransportClient implements RoomTransportClient {
  const WebSocketRoomTransportClient({
    this.socketFactory,
    this.codec = const ChatTransportCodec(),
  });

  final WebSocketChannelFactory? socketFactory;
  final ChatTransportCodec codec;

  @override
  RoomTransportSession connect(Uri uri) {
    final channel = (socketFactory ?? WebSocketChannel.connect)(uri);
    return WebSocketRoomTransportSession(channel: channel, codec: codec);
  }
}

class WebSocketRoomTransportSession implements RoomTransportSession {
  WebSocketRoomTransportSession({
    required WebSocketChannel channel,
    required ChatTransportCodec codec,
  }) : _channel = channel,
       _codec = codec;

  final WebSocketChannel _channel;
  final ChatTransportCodec _codec;

  @override
  Stream<ChatTransportEvent> get events =>
      _channel.stream.map(_codec.decodeEvent);

  @override
  Future<void> get ready => _channel.ready;

  @override
  void send(String frame) => _channel.sink.add(frame);

  @override
  Future<void> close() => _channel.sink.close();
}
