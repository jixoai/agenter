import 'chat_models.dart';

enum ChatViewConnectionState { idle, connecting, connected, closed, error }

class ReverseCursor {
  const ReverseCursor({required this.beforeTimeMs, required this.beforeId});

  final int beforeTimeMs;
  final int beforeId;
}

class ChatVisibleMessage {
  const ChatVisibleMessage({
    required this.viewKey,
    required this.rowId,
    this.messageId,
  });

  final String viewKey;
  final int rowId;
  final int? messageId;
}

class ChatViewState {
  const ChatViewState({
    required this.connectionState,
    required this.messages,
    this.channel,
    this.errorMessage,
    this.hasMoreBefore = false,
    this.nextBefore,
    this.loadingInitial = false,
    this.loadingMore = false,
    this.sending = false,
    this.focused = false,
    this.latestVisibleMessage,
  });

  const ChatViewState.initial()
    : this(
        connectionState: ChatViewConnectionState.idle,
        messages: const <ChatMessage>[],
      );

  final ChatViewConnectionState connectionState;
  final ChatChannel? channel;
  final List<ChatMessage> messages;
  final String? errorMessage;
  final bool hasMoreBefore;
  final ReverseCursor? nextBefore;
  final bool loadingInitial;
  final bool loadingMore;
  final bool sending;
  final bool focused;
  final ChatVisibleMessage? latestVisibleMessage;

  static const Object _sentinel = Object();

  ChatViewState copyWith({
    ChatViewConnectionState? connectionState,
    ChatChannel? channel,
    List<ChatMessage>? messages,
    Object? errorMessage = _sentinel,
    bool? hasMoreBefore,
    Object? nextBefore = _sentinel,
    bool? loadingInitial,
    bool? loadingMore,
    bool? sending,
    bool? focused,
    Object? latestVisibleMessage = _sentinel,
  }) {
    return ChatViewState(
      connectionState: connectionState ?? this.connectionState,
      channel: channel ?? this.channel,
      messages: messages ?? this.messages,
      errorMessage: identical(errorMessage, _sentinel)
          ? this.errorMessage
          : errorMessage as String?,
      hasMoreBefore: hasMoreBefore ?? this.hasMoreBefore,
      nextBefore: identical(nextBefore, _sentinel)
          ? this.nextBefore
          : nextBefore as ReverseCursor?,
      loadingInitial: loadingInitial ?? this.loadingInitial,
      loadingMore: loadingMore ?? this.loadingMore,
      sending: sending ?? this.sending,
      focused: focused ?? this.focused,
      latestVisibleMessage: identical(latestVisibleMessage, _sentinel)
          ? this.latestVisibleMessage
          : latestVisibleMessage as ChatVisibleMessage?,
    );
  }
}
