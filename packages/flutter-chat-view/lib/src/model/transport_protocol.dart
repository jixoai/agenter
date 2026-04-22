import 'dart:convert';

import 'chat_models.dart';
import 'chat_view_state.dart';

sealed class ChatTransportEvent {
  const ChatTransportEvent();
}

class ChatSnapshotEvent extends ChatTransportEvent {
  const ChatSnapshotEvent({
    required this.channel,
    required this.items,
    required this.hasMoreBefore,
    this.nextBefore,
  });

  final ChatChannel channel;
  final List<ChatMessage> items;
  final bool hasMoreBefore;
  final ReverseCursor? nextBefore;
}

class ChatMessagesEvent extends ChatTransportEvent {
  const ChatMessagesEvent(this.items);

  final List<ChatMessage> items;
}

class ChatPageEvent extends ChatTransportEvent {
  const ChatPageEvent({
    required this.items,
    required this.hasMoreBefore,
    this.nextBefore,
  });

  final List<ChatMessage> items;
  final bool hasMoreBefore;
  final ReverseCursor? nextBefore;
}

class ChatFocusEvent extends ChatTransportEvent {
  const ChatFocusEvent(this.focused);

  final bool focused;
}

class ChatErrorEvent extends ChatTransportEvent {
  const ChatErrorEvent(this.message);

  final String message;
}

Object? _asObject(Map<String, Object?> input, String key) => input[key];
Map<String, Object?> _requireMap(Map<String, Object?> input, String key) =>
    Map<String, Object?>.from(_asObject(input, key) as Map);
List<Object?> _requireList(Map<String, Object?> input, String key) =>
    List<Object?>.from(input[key] as List);
String _requireString(Map<String, Object?> input, String key) =>
    input[key] as String;
int _requireInt(Map<String, Object?> input, String key) =>
    (input[key] as num).toInt();
int? _optionalInt(Map<String, Object?> input, String key) =>
    (input[key] as num?)?.toInt();
bool _optionalBool(
  Map<String, Object?> input,
  String key, {
  bool fallback = false,
}) => (input[key] as bool?) ?? fallback;

ChatTransportEvent parseTransportEvent(String raw) {
  final decoded = jsonDecode(raw);
  if (decoded is! Map) {
    throw const FormatException('transport payload must be an object');
  }
  final payload = Map<String, Object?>.from(decoded);
  final type = _requireString(payload, 'type');
  switch (type) {
    case 'snapshot':
      final snapshot = _requireMap(payload, 'snapshot');
      return ChatSnapshotEvent(
        channel: parseChatChannel(_requireMap(snapshot, 'channel')),
        items: _parseMessages(_requireList(snapshot, 'items')),
        nextBefore: parseReverseCursor(snapshot['nextBefore']),
        hasMoreBefore: _optionalBool(snapshot, 'hasMoreBefore'),
      );
    case 'messages':
      return ChatMessagesEvent(_parseMessages(_requireList(payload, 'items')));
    case 'page':
      final page = _requireMap(payload, 'page');
      return ChatPageEvent(
        items: _parseMessages(_requireList(page, 'items')),
        nextBefore: parseReverseCursor(page['nextBefore']),
        hasMoreBefore: _optionalBool(page, 'hasMoreBefore'),
      );
    case 'focus':
      return ChatFocusEvent(_optionalBool(payload, 'focused'));
    case 'error':
      return ChatErrorEvent(_requireString(payload, 'message'));
    default:
      throw FormatException('unsupported transport event: $type');
  }
}

ReverseCursor? parseReverseCursor(Object? raw) {
  if (raw is! Map) {
    return null;
  }
  final payload = Map<String, Object?>.from(raw);
  return ReverseCursor(
    beforeTimeMs: _requireInt(payload, 'beforeTimeMs'),
    beforeId: _requireInt(payload, 'beforeId'),
  );
}

ChatChannel parseChatChannel(Map<String, Object?> payload) {
  final rawParticipants = payload['participants'] as List? ?? const <Object?>[];
  return ChatChannel(
    chatId: _requireString(payload, 'chatId'),
    kind: _requireString(payload, 'kind'),
    title: _requireString(payload, 'title'),
    owner: _requireString(payload, 'owner'),
    participants: rawParticipants
        .map((entry) => Map<String, Object?>.from(entry as Map))
        .map(
          (entry) => ChatParticipant(
            id: _requireString(entry, 'id'),
            label: entry['label'] as String?,
          ),
        )
        .toList(growable: false),
    accessToken: _requireString(payload, 'accessToken'),
    transportUrl: _requireString(payload, 'transportUrl'),
    participantId: payload['participantId'] as String?,
  );
}

List<ChatMessage> _parseMessages(List<Object?> items) {
  return items
      .map((entry) => parseChatMessage(Map<String, Object?>.from(entry as Map)))
      .toList(growable: false);
}

ChatMessage parseChatMessage(Map<String, Object?> payload) {
  final messageId = _optionalInt(payload, 'messageId');
  final rawAttachments = payload['attachments'] as List? ?? const <Object?>[];
  final payloadData = payload['payload'];
  return ChatMessage(
    viewKey: '${messageId ?? 'row'}:${_requireInt(payload, 'rowId')}',
    rowId: _requireInt(payload, 'rowId'),
    messageId: messageId,
    chatId: _requireString(payload, 'chatId'),
    ref: _optionalInt(payload, 'ref'),
    senderActorId: payload['senderActorId'] as String?,
    from: _requireString(payload, 'from'),
    kind: parseMessageKind(_requireString(payload, 'kind')),
    content: _requireString(payload, 'content'),
    createdAt: _requireInt(payload, 'createdAt'),
    updatedAt: _requireInt(payload, 'updatedAt'),
    visibleAt: _optionalInt(payload, 'visibleAt'),
    recalledAt: _optionalInt(payload, 'recalledAt'),
    readActorIds: (payload['readActorIds'] as List? ?? const <Object?>[])
        .cast<String>(),
    unreadActorIds: (payload['unreadActorIds'] as List? ?? const <Object?>[])
        .cast<String>(),
    attachments: rawAttachments
        .map((entry) => Map<String, Object?>.from(entry as Map))
        .map(parseChatAttachment)
        .toList(growable: false),
    payload: payloadData is Map
        ? parseChatPayload(Map<String, Object?>.from(payloadData))
        : null,
  );
}

ChatMessageKind parseMessageKind(String value) {
  switch (value) {
    case 'error':
      return ChatMessageKind.error;
    case 'interactive':
      return ChatMessageKind.interactive;
    default:
      return ChatMessageKind.text;
  }
}

ChatAttachment parseChatAttachment(Map<String, Object?> payload) {
  return ChatAttachment(
    assetId: _requireString(payload, 'assetId'),
    kind: parseAttachmentKind(_requireString(payload, 'kind')),
    name: _requireString(payload, 'name'),
    mimeType: _requireString(payload, 'mimeType'),
    sizeBytes: _requireInt(payload, 'sizeBytes'),
    url: _requireString(payload, 'url'),
  );
}

ChatAttachmentKind parseAttachmentKind(String value) {
  switch (value) {
    case 'image':
      return ChatAttachmentKind.image;
    case 'video':
      return ChatAttachmentKind.video;
    default:
      return ChatAttachmentKind.file;
  }
}

ChatMessagePayload parseChatPayload(Map<String, Object?> payload) {
  final error = payload['error'];
  final interactive = payload['interactive'];
  return ChatMessagePayload(
    errorTitle: error is Map ? error['title'] as String? : null,
    errorCode: error is Map ? error['code'] as String? : null,
    errorDetail: error is Map ? error['detail'] as String? : null,
    interactive: interactive is Map
        ? ChatInteractivePayload(
            title: interactive['title'] as String? ?? '',
            description: interactive['description'] as String?,
            submitLabel: interactive['submitLabel'] as String?,
            fields: (interactive['fields'] as List? ?? const <Object?>[])
                .map((entry) => Map<String, Object?>.from(entry as Map))
                .map(
                  (field) => ChatInteractiveField(
                    id: _requireString(field, 'id'),
                    label: _requireString(field, 'label'),
                    placeholder: field['placeholder'] as String?,
                    required: (field['required'] as bool?) ?? false,
                    multiline: (field['multiline'] as bool?) ?? false,
                    initialValue: field['initialValue'] as String?,
                  ),
                )
                .toList(growable: false),
          )
        : null,
  );
}

String encodeSendFrame({
  required String text,
  List<ChatAttachment> attachments = const <ChatAttachment>[],
  int? ref,
}) {
  return jsonEncode({
    'type': 'send',
    'message': {
      'kind': 'text',
      'content': text,
      ...?ref == null ? null : {'ref': ref},
      ...?attachments.isEmpty
          ? null
          : {
              'attachments': attachments
                  .map(
                    (attachment) => {
                      'assetId': attachment.assetId,
                      'kind': attachment.kind.name,
                      'name': attachment.name,
                      'mimeType': attachment.mimeType,
                      'sizeBytes': attachment.sizeBytes,
                      'url': attachment.url,
                    },
                  )
                  .toList(growable: false),
            },
    },
  });
}

String encodeEditFrame({required int messageId, required String text}) {
  return jsonEncode({
    'type': 'edit',
    'message': {'messageId': messageId, 'content': text},
  });
}

String encodeRecallFrame({required int messageId}) {
  return jsonEncode({
    'type': 'recall',
    'message': {'messageId': messageId},
  });
}

String encodePageFrame({ReverseCursor? before, int? limit}) {
  return jsonEncode({
    'type': 'page',
    ...?before == null
        ? null
        : {
            'before': {
              'beforeTimeMs': before.beforeTimeMs,
              'beforeId': before.beforeId,
            },
          },
    ...?limit == null ? null : {'limit': limit},
  });
}

String encodeFocusFrame(bool focused) =>
    jsonEncode({'type': 'focus', 'focused': focused});
