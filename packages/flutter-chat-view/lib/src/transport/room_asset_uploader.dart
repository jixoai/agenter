import 'dart:convert';

import 'package:cross_file/cross_file.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../model/chat_models.dart';
import '../model/transport_protocol.dart';

abstract class RoomAssetUploader {
  Future<List<ChatAttachment>> upload({
    required Uri httpBaseUri,
    required String chatId,
    required String accessToken,
    required List<XFile> files,
  });
}

class HttpRoomAssetUploader implements RoomAssetUploader {
  const HttpRoomAssetUploader({this.httpClient});

  final http.Client? httpClient;

  @override
  Future<List<ChatAttachment>> upload({
    required Uri httpBaseUri,
    required String chatId,
    required String accessToken,
    required List<XFile> files,
  }) async {
    final client = httpClient ?? http.Client();
    try {
      final request = http.MultipartRequest(
        'POST',
        httpBaseUri.resolve('/api/rooms/${Uri.encodeComponent(chatId)}/assets'),
      );
      request.headers['x-agenter-room-access-token'] = accessToken;
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
}
