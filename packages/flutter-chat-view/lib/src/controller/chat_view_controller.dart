import 'dart:async';

import 'package:cross_file/cross_file.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../model/chat_message_merge.dart';
import '../model/chat_models.dart';
import '../model/chat_view_state.dart';
import '../model/transport_codec.dart';
import '../model/transport_protocol.dart';
import '../transport/room_asset_uploader.dart';
import '../transport/room_transport.dart';
import '../util/transport_urls.dart';

export '../transport/room_asset_uploader.dart'
    show HttpRoomAssetUploader, RoomAssetUploader;
export '../transport/room_transport.dart'
    show
        RoomTransportClient,
        RoomTransportSession,
        WebSocketChannelFactory,
        WebSocketRoomTransportClient;

typedef ScreenshotCaptureDelegate = Future<XFile> Function();

class ChatViewController extends ChangeNotifier {
  ChatViewController({
    required this.transportUrl,
    this.accessToken,
    this.httpClient,
    WebSocketChannelFactory? socketFactory,
    RoomTransportClient? transportClient,
    RoomAssetUploader? assetUploader,
    this.screenshotCapture,
    this.connectionTimeout = const Duration(seconds: 8),
    this.codec = const ChatTransportCodec(),
  }) : _transportClient =
           transportClient ??
           WebSocketRoomTransportClient(socketFactory: socketFactory),
       _assetUploader =
           assetUploader ?? HttpRoomAssetUploader(httpClient: httpClient),
       _state = const ChatViewState.initial();

  final String transportUrl;
  final String? accessToken;
  final http.Client? httpClient;
  final ScreenshotCaptureDelegate? screenshotCapture;
  final Duration connectionTimeout;
  final ChatTransportCodec codec;

  final RoomTransportClient _transportClient;
  final RoomAssetUploader _assetUploader;

  ChatViewState _state;
  RoomTransportSession? _session;
  StreamSubscription<ChatTransportEvent>? _subscription;

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
    final session = _transportClient.connect(resolvedTransportUri);
    _session = session;
    _subscription = session.events.listen(
      _handleTransportEvent,
      onError: (Object error, StackTrace stackTrace) {
        _session = null;
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
        _session = null;
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
      await session.ready.timeout(
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
    _sendFrame(codec.encodePage(before: _state.nextBefore, limit: limit));
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
        codec.encodeSend(text: normalized, attachments: uploaded, ref: ref),
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
    _sendFrame(codec.encodeEdit(messageId: messageId, text: text.trim()));
  }

  Future<void> recallMessage(int messageId) async {
    _sendFrame(codec.encodeRecall(messageId: messageId));
  }

  Future<void> updateFocus(bool focused) async {
    if (_session == null) {
      return;
    }
    _sendFrame(codec.encodeFocus(focused));
    _setState(_state.copyWith(focused: focused));
  }

  Future<List<ChatAttachment>> uploadAttachments(List<XFile> files) async {
    final token = accessToken?.trim();
    if (token == null || token.isEmpty) {
      throw StateError('room asset upload requires access token');
    }
    return _assetUploader.upload(
      httpBaseUri: resolvedHttpBaseUri,
      chatId: chatId,
      accessToken: token,
      files: files,
    );
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

  void _handleTransportEvent(ChatTransportEvent event) {
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
    final session = _session;
    if (session == null) {
      throw StateError('transport is not connected');
    }
    session.send(frame);
  }

  Future<void> _closeTransport() async {
    await _subscription?.cancel();
    _subscription = null;
    await _session?.close();
    _session = null;
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
