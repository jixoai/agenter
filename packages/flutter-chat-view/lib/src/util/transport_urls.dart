Uri resolveTransportUri({required String transportUrl, String? accessToken}) {
  final baseUri = Uri.parse(transportUrl.trim());
  if (accessToken == null || accessToken.trim().isEmpty) {
    return baseUri;
  }
  return baseUri.replace(
    queryParameters: {...baseUri.queryParameters, 'token': accessToken.trim()},
  );
}

Uri deriveHttpBaseUri(Uri transportUri) {
  final scheme = switch (transportUri.scheme) {
    'wss' => 'https',
    'ws' => 'http',
    _ => transportUri.scheme,
  };
  return transportUri.hasPort
      ? Uri(scheme: scheme, host: transportUri.host, port: transportUri.port)
      : Uri(scheme: scheme, host: transportUri.host);
}

String extractChatId(Uri transportUri) {
  if (transportUri.pathSegments.isEmpty) {
    throw const FormatException('transport URL must include /room/<chatId>');
  }
  return Uri.decodeComponent(transportUri.pathSegments.last);
}
