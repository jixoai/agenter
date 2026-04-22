import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../model/connection_profile.dart';

abstract class ConnectionProfileStore {
  Future<ConnectionProfilesSnapshot> load();

  Future<void> save(ConnectionProfilesSnapshot snapshot);
}

class SharedPreferencesConnectionProfileStore
    implements ConnectionProfileStore {
  static const String _snapshotKey = 'flutter_chat_view.product_shell.snapshot';

  @override
  Future<ConnectionProfilesSnapshot> load() async {
    final preferences = await SharedPreferences.getInstance();
    final rawSnapshot = preferences.getString(_snapshotKey);
    if (rawSnapshot == null || rawSnapshot.isEmpty) {
      return const ConnectionProfilesSnapshot(profiles: <ConnectionProfile>[]);
    }
    final decoded = jsonDecode(rawSnapshot);
    if (decoded is! Map<String, Object?>) {
      return const ConnectionProfilesSnapshot(profiles: <ConnectionProfile>[]);
    }
    return ConnectionProfilesSnapshot.fromJson(decoded);
  }

  @override
  Future<void> save(ConnectionProfilesSnapshot snapshot) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_snapshotKey, jsonEncode(snapshot.toJson()));
  }
}

class MemoryConnectionProfileStore implements ConnectionProfileStore {
  MemoryConnectionProfileStore([ConnectionProfilesSnapshot? initialSnapshot])
    : _snapshot =
          initialSnapshot ??
          const ConnectionProfilesSnapshot(profiles: <ConnectionProfile>[]);

  ConnectionProfilesSnapshot _snapshot;

  @override
  Future<ConnectionProfilesSnapshot> load() async => _snapshot;

  @override
  Future<void> save(ConnectionProfilesSnapshot snapshot) async {
    _snapshot = snapshot;
  }
}
