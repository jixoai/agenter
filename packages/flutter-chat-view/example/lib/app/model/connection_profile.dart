class ConnectionProfile {
  const ConnectionProfile({
    required this.id,
    required this.name,
    required this.transportUrl,
    this.accessToken,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String name;
  final String transportUrl;
  final String? accessToken;
  final int createdAt;
  final int updatedAt;

  String get displayName => name.trim().isEmpty ? hostLabel : name.trim();

  String get hostLabel {
    final uri = Uri.tryParse(transportUrl.trim());
    final host = uri?.host.trim();
    if (host == null || host.isEmpty) {
      return transportUrl.trim().isEmpty ? 'Unknown room' : transportUrl.trim();
    }
    final room = uri == null || uri.pathSegments.isEmpty
        ? ''
        : uri.pathSegments.last;
    if (room.isEmpty) {
      return host;
    }
    return '$host/$room';
  }

  bool matchesTransport(String otherTransportUrl, String? otherAccessToken) {
    return transportUrl.trim() == otherTransportUrl.trim() &&
        (accessToken?.trim() ?? '') == (otherAccessToken?.trim() ?? '');
  }

  ConnectionProfile copyWith({
    String? id,
    String? name,
    String? transportUrl,
    Object? accessToken = _sentinel,
    int? createdAt,
    int? updatedAt,
  }) {
    return ConnectionProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      transportUrl: transportUrl ?? this.transportUrl,
      accessToken: identical(accessToken, _sentinel)
          ? this.accessToken
          : accessToken as String?,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, Object?> toJson() {
    return {
      'id': id,
      'name': name,
      'transportUrl': transportUrl,
      'accessToken': accessToken,
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }

  factory ConnectionProfile.fromJson(Map<String, Object?> json) {
    return ConnectionProfile(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      transportUrl: json['transportUrl'] as String,
      accessToken: json['accessToken'] as String?,
      createdAt: (json['createdAt'] as num).toInt(),
      updatedAt: (json['updatedAt'] as num).toInt(),
    );
  }

  static const Object _sentinel = Object();
}

class ConnectionProfileDraft {
  const ConnectionProfileDraft({
    required this.name,
    required this.transportUrl,
    this.accessToken,
  });

  final String name;
  final String transportUrl;
  final String? accessToken;
}

class ConnectionProfilesSnapshot {
  const ConnectionProfilesSnapshot({
    required this.profiles,
    this.activeProfileId,
  });

  final List<ConnectionProfile> profiles;
  final String? activeProfileId;

  Map<String, Object?> toJson() {
    return {
      'profiles': profiles.map((profile) => profile.toJson()).toList(),
      'activeProfileId': activeProfileId,
    };
  }

  factory ConnectionProfilesSnapshot.fromJson(Map<String, Object?> json) {
    final rawProfiles = json['profiles'] as List? ?? const <Object?>[];
    return ConnectionProfilesSnapshot(
      profiles: rawProfiles
          .map(
            (entry) => ConnectionProfile.fromJson(
              Map<String, Object?>.from(entry as Map),
            ),
          )
          .toList(growable: false),
      activeProfileId: json['activeProfileId'] as String?,
    );
  }
}

ConnectionProfile? bootstrapProfileFromUri(Uri uri) {
  final transportUrl = uri.queryParameters['url']?.trim();
  if (transportUrl == null || transportUrl.isEmpty) {
    return null;
  }
  final now = DateTime.now().microsecondsSinceEpoch;
  final parsed = Uri.tryParse(transportUrl);
  final suggestedName = parsed == null || parsed.pathSegments.isEmpty
      ? 'Shared room'
      : parsed.pathSegments.last;
  final rawToken = uri.queryParameters['token']?.trim();
  return ConnectionProfile(
    id: 'shared-$now',
    name: suggestedName,
    transportUrl: transportUrl,
    accessToken: rawToken == null || rawToken.isEmpty ? null : rawToken,
    createdAt: now,
    updatedAt: now,
  );
}
