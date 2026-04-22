import 'dart:async';
import 'dart:convert';

import 'package:cross_file/cross_file.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../model/chat_message_merge.dart';
import '../model/chat_models.dart';
import '../model/chat_view_state.dart';
import '../model/transport_protocol.dart';
import '../util/transport_urls.dart';

typedef WebSocketChannelFactory = WebSocketChannel Function(Uri uri);
typedef ScreenshotCaptureDelegate = Future<XFile> Function();

class ChatViewController extends ChangeNotifier {
  ChatViewController({
    required this.transportUrl,
    this.accessToken,
    this.httpClient,
    this.socketFactory,
    this.screenshotCapture,
    this.connectionTimeout = const Duration(seconds: 8),
  }) : _state = const ChatViewState.initial();

  final String transportUrl;
  final String? accessToken;
  final http.Client? httpClient;
  final WebSocketChannelFactory? socketFactory;
  final ScreenshotCaptureDelegate? screenshotCapture;
  final Duration connectionTimeout;

  ChatViewState _state;
  WebSocketChannel? _channel;
  StreamSubscription<Object?>? _subscription;

  ChatViewState get state => _state;
  Uri get resolvedTransportUri =>
      resolveTransportUri(transportUrl: transportUrl, accessToken: accessToken);
  Uri get resolvedHttpBaseUri => deriveHttpBaseUri(resolvedTransportUri);
  String get chatId => extractChatId(resolvedTransportUri);
  bool get supportsAttachments =>
      accessToken != null && accessToken!.trim().isNotEmpty;

  Future<void> connect() async {
    await disconnect();
    _setState(
      _state.copyWith(
        connectionState: ChatViewConnectionState.connecting,
        loadingInitial: true,
        errorMessage: null,
      ),
    );
    final channel = (socketFactory ?? WebSocketChannel.connect)(
      resolvedTransportUri,
    );
    _channel = channel;
    _subscription = channel.stream.listen(
      _handleRawTransportEvent,
      onError: (Object error, StackTrace stackTrace) {
        _channel = null;
        _subscription = null;
        _setState(
          _state.copyWith(
            connectionState: ChatViewConnectionState.error,
            loadingInitial: false,
            loadingMore: false,
            sending: false,
            errorMessage: error.toString(),
          ),
        );
      },
      onDone: () {
        _channel = null;
        _subscription = null;
        _setState(
          _state.copyWith(
            connectionState: ChatViewConnectionState.closed,
            loadingInitial: false,
            loadingMore: false,
            sending: false,
          ),
        );
      },
      cancelOnError: false,
    );
    try {
      await channel.ready.timeout(
        connectionTimeout,
        onTimeout: () {
          throw TimeoutException(
            'room websocket connection timed out',
            connectionTimeout,
          );
        },
      );
      _setState(
        _state.copyWith(connectionState: ChatViewConnectionState.connected),
      );
      await updateFocus(true);
    } catch (error) {
      await _closeTransport();
      _setState(
        _state.copyWith(
          connectionState: ChatViewConnectionState.error,
          loadingInitial: false,
          errorMessage: error.toString(),
        ),
      );
    }
  }

  Future<void> disconnect() async {
    await _closeTransport();
    if (_state.connectionState != ChatViewConnectionState.idle) {
      _setState(
        _state.copyWith(
          connectionState: ChatViewConnectionState.closed,
          focused: false,
        ),
      );
    }
  }

  Future<void> requestOlderPage({int limit = 60}) async {
    if (_state.loadingMore || !_state.hasMoreBefore) {
      return;
    }
    _sendFrame(encodePageFrame(before: _state.nextBefore, limit: limit));
    _setState(_state.copyWith(loadingMore: true));
  }

  Future<void> sendText(
    String text, {
    List<XFile> attachments = const <XFile>[],
    int? ref,
  }) async {
    final normalized = text.trim();
    if (normalized.isEmpty && attachments.isEmpty) {
      return;
    }
    _setState(_state.copyWith(sending: true, errorMessage: null));
    try {
      final uploaded = attachments.isEmpty
          ? const <ChatAttachment>[]
          : await uploadAttachments(attachments);
      _sendFrame(
        encodeSendFrame(text: normalized, attachments: uploaded, ref: ref),
      );
      _setState(_state.copyWith(sending: false));
    } catch (error) {
      _setState(
        _state.copyWith(sending: false, errorMessage: error.toString()),
      );
      rethrow;
    }
  }

  Future<void> editMessage({
    required int messageId,
    required String text,
  }) async {
    _sendFrame(encodeEditFrame(messageId: messageId, text: text.trim()));
  }

  Future<void> recallMessage(int messageId) async {
    _sendFrame(encodeRecallFrame(messageId: messageId));
  }

  Future<void> updateFocus(bool focused) async {
    if (_channel == null) {
      return;
    }
    _sendFrame(encodeFocusFrame(focused));
    _setState(_state.copyWith(focused: focused));
  }

  Future<List<ChatAttachment>> uploadAttachments(List<XFile> files) async {
    final token = accessToken?.trim();
    if (token == null || token.isEmpty) {
      throw StateError('room asset upload requires access token');
    }
    final client = httpClient ?? http.Client();
    try {
      final request = http.MultipartRequest(
        'POST',
        resolvedHttpBaseUri.resolve(
          '/api/rooms/${Uri.encodeComponent(chatId)}/assets',
        ),
      );
      request.headers['x-agenter-room-access-token'] = token;
      for (final file in files) {
        final bytes = await file.readAsBytes();
        final mimeType = file.mimeType;
        request.files.add(
          http.MultipartFile.fromBytes(
            'files',
            bytes,
            filename: file.name,
            contentType: MediaType.parse(
              mimeType == null || mimeType.isEmpty
                  ? 'application/octet-stream'
                  : mimeType,
            ),
          ),
        );
      }
      final streamed = await client.send(request);
      final response = await http.Response.fromStream(streamed);
      final payload = jsonDecode(response.body);
      if (payload is! Map<String, Object?> ||
          response.statusCode < 200 ||
          response.statusCode >= 300) {
        throw StateError('room asset upload failed (${response.statusCode})');
      }
      if ((payload['ok'] as bool?) != true) {
        throw StateError(
          payload['error'] as String? ?? 'room asset upload failed',
        );
      }
      return (payload['items'] as List? ?? const <Object?>[])
          .map((entry) => Map<String, Object?>.from(entry as Map))
          .map(
            (entry) => ChatAttachment(
              assetId: entry['assetId'] as String,
              kind: parseAttachmentKind(entry['kind'] as String),
              name: entry['name'] as String,
              mimeType: entry['mimeType'] as String,
              sizeBytes: (entry['sizeBytes'] as num).toInt(),
              url: entry['url'] as String,
            ),
          )
          .toList(growable: false);
    } finally {
      if (httpClient == null) {
        client.close();
      }
    }
  }

  void setMessageVisibility(ChatMessage message, double visibleFraction) {
    if (visibleFraction <= 0) {
      return;
    }
    final current = _state.latestVisibleMessage;
    if (current != null && current.rowId >= message.rowId) {
      return;
    }
    _setState(
      _state.copyWith(
        latestVisibleMessage: ChatVisibleMessage(
          viewKey: message.viewKey,
          rowId: message.rowId,
          messageId: message.messageId,
        ),
      ),
    );
  }

  void _handleRawTransportEvent(Object? raw) {
    final rawText = switch (raw) {
      String value => value,
      List<int> value => utf8.decode(value),
      _ => throw const FormatException('unsupported websocket payload'),
    };
    final event = parseTransportEvent(rawText);
    switch (event) {
      case ChatSnapshotEvent():
        _setState(
          _state.copyWith(
            connectionState: ChatViewConnectionState.connected,
            channel: event.channel,
            messages: event.items..sort(compareChatMessages),
            nextBefore: event.nextBefore,
            hasMoreBefore: event.hasMoreBefore,
            loadingInitial: false,
            loadingMore: false,
            errorMessage: null,
          ),
        );
      case ChatMessagesEvent():
        _setState(
          _state.copyWith(
            messages: mergeChatMessages(_state.messages, event.items),
            sending: false,
            errorMessage: null,
          ),
        );
      case ChatPageEvent():
        _setState(
          _state.copyWith(
            messages: mergeChatMessages(_state.messages, event.items),
            nextBefore: event.nextBefore,
            hasMoreBefore: event.hasMoreBefore,
            loadingMore: false,
            errorMessage: null,
          ),
        );
      case ChatFocusEvent():
        _setState(_state.copyWith(focused: event.focused));
      case ChatErrorEvent():
        _setState(
          _state.copyWith(
            connectionState: ChatViewConnectionState.error,
            loadingInitial: false,
            loadingMore: false,
            sending: false,
            errorMessage: event.message,
          ),
        );
    }
  }

  void _sendFrame(String frame) {
    final channel = _channel;
    if (channel == null) {
      throw StateError('transport is not connected');
    }
    channel.sink.add(frame);
  }

  Future<void> _closeTransport() async {
    await _subscription?.cancel();
    _subscription = null;
    await _channel?.sink.close();
    _channel = null;
  }

  void _setState(ChatViewState nextState) {
    _state = nextState;
    notifyListeners();
  }

  @override
  void dispose() {
    unawaited(_closeTransport());
    super.dispose();
  }
}
