enum ChatMessageKind { text, error, interactive }

enum ChatAttachmentKind { image, video, file }

class ChatParticipant {
  const ChatParticipant({required this.id, this.label});

  final String id;
  final String? label;
}

class ChatAttachment {
  const ChatAttachment({
    required this.assetId,
    required this.kind,
    required this.name,
    required this.mimeType,
    required this.sizeBytes,
    required this.url,
  });

  final String assetId;
  final ChatAttachmentKind kind;
  final String name;
  final String mimeType;
  final int sizeBytes;
  final String url;
}

class ChatInteractiveField {
  const ChatInteractiveField({
    required this.id,
    required this.label,
    this.placeholder,
    this.required = false,
    this.multiline = false,
    this.initialValue,
  });

  final String id;
  final String label;
  final String? placeholder;
  final bool required;
  final bool multiline;
  final String? initialValue;
}

class ChatInteractivePayload {
  const ChatInteractivePayload({
    required this.title,
    required this.fields,
    this.description,
    this.submitLabel,
  });

  final String title;
  final List<ChatInteractiveField> fields;
  final String? description;
  final String? submitLabel;
}

class ChatMessagePayload {
  const ChatMessagePayload({
    this.errorTitle,
    this.errorCode,
    this.errorDetail,
    this.interactive,
  });

  final String? errorTitle;
  final String? errorCode;
  final String? errorDetail;
  final ChatInteractivePayload? interactive;
}

class ChatChannel {
  const ChatChannel({
    required this.chatId,
    required this.kind,
    required this.title,
    required this.owner,
    required this.participants,
    required this.accessToken,
    required this.transportUrl,
    this.participantId,
  });

  final String chatId;
  final String kind;
  final String title;
  final String owner;
  final List<ChatParticipant> participants;
  final String accessToken;
  final String transportUrl;
  final String? participantId;

  String get displayTitle => title.trim().isEmpty ? chatId : title;
}

class ChatMessage {
  const ChatMessage({
    required this.viewKey,
    required this.rowId,
    required this.chatId,
    required this.from,
    required this.kind,
    required this.content,
    required this.createdAt,
    required this.updatedAt,
    required this.readActorIds,
    required this.unreadActorIds,
    this.messageId,
    this.ref,
    this.senderActorId,
    this.visibleAt,
    this.recalledAt,
    this.attachments = const <ChatAttachment>[],
    this.payload,
  });

  final String viewKey;
  final int rowId;
  final int? messageId;
  final String chatId;
  final int? ref;
  final String? senderActorId;
  final String from;
  final ChatMessageKind kind;
  final String content;
  final int createdAt;
  final int updatedAt;
  final int? visibleAt;
  final int? recalledAt;
  final List<String> readActorIds;
  final List<String> unreadActorIds;
  final List<ChatAttachment> attachments;
  final ChatMessagePayload? payload;

  bool get isRecalled => recalledAt != null;
  bool get isEdited => !isRecalled && updatedAt > createdAt;
  bool get isInteractive =>
      kind == ChatMessageKind.interactive && payload?.interactive != null;
  String get displayText => content;

  ChatMessage copyWith({
    String? viewKey,
    int? rowId,
    int? messageId,
    String? chatId,
    int? ref,
    String? senderActorId,
    String? from,
    ChatMessageKind? kind,
    String? content,
    int? createdAt,
    int? updatedAt,
    int? visibleAt,
    int? recalledAt,
    List<String>? readActorIds,
    List<String>? unreadActorIds,
    List<ChatAttachment>? attachments,
    ChatMessagePayload? payload,
  }) {
    return ChatMessage(
      viewKey: viewKey ?? this.viewKey,
      rowId: rowId ?? this.rowId,
      messageId: messageId ?? this.messageId,
      chatId: chatId ?? this.chatId,
      ref: ref ?? this.ref,
      senderActorId: senderActorId ?? this.senderActorId,
      from: from ?? this.from,
      kind: kind ?? this.kind,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      visibleAt: visibleAt ?? this.visibleAt,
      recalledAt: recalledAt ?? this.recalledAt,
      readActorIds: readActorIds ?? this.readActorIds,
      unreadActorIds: unreadActorIds ?? this.unreadActorIds,
      attachments: attachments ?? this.attachments,
      payload: payload ?? this.payload,
    );
  }
}
