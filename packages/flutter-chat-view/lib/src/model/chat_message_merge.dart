import 'chat_models.dart';

String resolveMessageIdentityKey(ChatMessage message) =>
    message.messageId != null
    ? 'durable:${message.messageId}'
    : 'view:${message.viewKey}';

int compareChatMessages(ChatMessage left, ChatMessage right) {
  if (left.createdAt != right.createdAt) {
    return left.createdAt.compareTo(right.createdAt);
  }
  if (left.rowId != right.rowId) {
    return left.rowId.compareTo(right.rowId);
  }
  return left.viewKey.compareTo(right.viewKey);
}

bool _sameAttachmentSet(List<ChatAttachment> left, List<ChatAttachment> right) {
  if (left.length != right.length) {
    return false;
  }
  for (var index = 0; index < left.length; index += 1) {
    final leftItem = left[index];
    final rightItem = right[index];
    if (leftItem.assetId != rightItem.assetId ||
        leftItem.kind != rightItem.kind ||
        leftItem.mimeType != rightItem.mimeType ||
        leftItem.name != rightItem.name ||
        leftItem.sizeBytes != rightItem.sizeBytes) {
      return false;
    }
  }
  return true;
}

bool _sameSemanticMessage(ChatMessage left, ChatMessage right) {
  return left.chatId == right.chatId &&
      left.senderActorId == right.senderActorId &&
      left.from == right.from &&
      left.content == right.content &&
      left.createdAt == right.createdAt &&
      _sameAttachmentSet(left.attachments, right.attachments);
}

int _messageAuthority(ChatMessage message) {
  return (message.messageId != null ? 1000 : 0) +
      (message.ref != null ? 10 : 0) +
      message.attachments.length +
      (message.payload != null ? 1 : 0);
}

List<ChatMessage> _collapseSemanticDuplicates(List<ChatMessage> messages) {
  final deduped = <ChatMessage>[];
  for (final message in messages) {
    final duplicateIndex = deduped.indexWhere(
      (existing) => _sameSemanticMessage(existing, message),
    );
    if (duplicateIndex == -1) {
      deduped.add(message);
      continue;
    }
    if (_messageAuthority(message) >
        _messageAuthority(deduped[duplicateIndex])) {
      deduped[duplicateIndex] = message;
    }
  }
  deduped.sort(compareChatMessages);
  return deduped;
}

List<ChatMessage> mergeChatMessages(
  List<ChatMessage> current,
  List<ChatMessage> incoming,
) {
  final byId = <String, ChatMessage>{};
  for (final message in current) {
    byId[resolveMessageIdentityKey(message)] = message;
  }
  for (final message in incoming) {
    byId[resolveMessageIdentityKey(message)] = message;
  }
  return _collapseSemanticDuplicates(byId.values.toList(growable: false));
}
