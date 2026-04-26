import 'dart:convert';

import 'chat_models.dart';
import 'chat_view_state.dart';
import 'transport_protocol.dart';

class ChatTransportCodec {
  const ChatTransportCodec();

  ChatTransportEvent decodeEvent(Object? raw) {
    final rawText = switch (raw) {
      String value => value,
      List<int> value => utf8.decode(value),
      _ => throw ChatTransportCodecException('unsupported websocket payload'),
    };
    try {
      return parseTransportEvent(rawText);
    } on FormatException catch (error) {
      throw ChatTransportCodecException(error.message, error);
    } on TypeError catch (error) {
      throw ChatTransportCodecException(
        'invalid transport payload shape',
        error,
      );
    }
  }

  String encodeSend({
    required String text,
    required List<ChatAttachment> attachments,
    int? ref,
  }) => encodeSendFrame(text: text, attachments: attachments, ref: ref);

  String encodeEdit({required int messageId, required String text}) =>
      encodeEditFrame(messageId: messageId, text: text);

  String encodeRecall({required int messageId}) =>
      encodeRecallFrame(messageId: messageId);

  String encodePage({ReverseCursor? before, int? limit}) =>
      encodePageFrame(before: before, limit: limit);

  String encodeFocus(bool focused) => encodeFocusFrame(focused);
}

class ChatTransportCodecException implements FormatException {
  const ChatTransportCodecException(this.message, [this.source]);

  @override
  final String message;

  @override
  final Object? source;

  @override
  int? get offset => null;

  @override
  String toString() => 'ChatTransportCodecException: $message';
}
