import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../model/connection_profile.dart';
import '../model/product_shell_notice.dart';
import '../store/connection_profile_store.dart';

enum ProductShellRouteDepth {
  conversation,
  profileDirectory,
  roomInspector,
  messageInspector,
}

class ProductShellController extends ChangeNotifier {
  ProductShellController({required this.store, this.connectOnActivate = true});

  final ConnectionProfileStore store;
  final bool connectOnActivate;

  bool _bootstrapping = true;
  List<ConnectionProfile> _profiles = const <ConnectionProfile>[];
  String? _activeProfileId;
  String? _selectedMessageViewKey;
  ProductShellNotice? _surfaceNotice;
  ProductShellRouteDepth _routeDepth = ProductShellRouteDepth.conversation;
  ChatViewController? _chatController;

  bool get bootstrapping => _bootstrapping;
  List<ConnectionProfile> get profiles => _profiles;
  String? get activeProfileId => _activeProfileId;
  ProductShellRouteDepth get routeDepth => _routeDepth;
  ChatViewController? get chatController => _chatController;
  ProductShellNotice? get surfaceNotice => _surfaceNotice;

  ConnectionProfile? get activeProfile {
    for (final profile in _profiles) {
      if (profile.id == _activeProfileId) {
        return profile;
      }
    }
    return null;
  }

  ChatMessage? get selectedMessage {
    final targetKey = _selectedMessageViewKey;
    final controller = _chatController;
    if (targetKey == null || controller == null) {
      return null;
    }
    for (final message in controller.state.messages) {
      if (message.viewKey == targetKey) {
        return message;
      }
    }
    return null;
  }

  Future<void> initialize(Uri bootstrapUri) async {
    _bootstrapping = true;
    notifyListeners();

    final snapshot = await store.load();
    _profiles = snapshot.profiles;
    _activeProfileId = snapshot.activeProfileId;

    final bootstrapProfile = bootstrapProfileFromUri(bootstrapUri);
    if (bootstrapProfile != null) {
      final existing = _findMatchingProfile(
        bootstrapProfile.transportUrl,
        bootstrapProfile.accessToken,
      );
      final effectiveProfile = existing ?? bootstrapProfile;
      if (existing == null) {
        _profiles = <ConnectionProfile>[bootstrapProfile, ..._profiles];
      }
      _activeProfileId = effectiveProfile.id;
      _surfaceNotice = ProductShellNotice(
        existing == null
            ? ProductShellNoticeKind.importedSharedRoomLink
            : ProductShellNoticeKind.loadedSharedRoomLink,
      );
      await _persist();
    }

    _bootstrapping = false;
    notifyListeners();

    if (_activeProfileId case final activeProfileId?) {
      await activateProfile(activeProfileId, persist: false);
    }
  }

  Future<void> saveProfile(
    ConnectionProfileDraft draft, {
    String? profileId,
  }) async {
    final now = DateTime.now().microsecondsSinceEpoch;
    final previous = profileId == null ? null : _findProfile(profileId);
    final nextProfile = ConnectionProfile(
      id: previous?.id ?? 'profile-$now',
      name: draft.name.trim(),
      transportUrl: draft.transportUrl.trim(),
      accessToken: draft.accessToken?.trim().isEmpty ?? true
          ? null
          : draft.accessToken?.trim(),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    );

    final nextProfiles = <ConnectionProfile>[];
    var replaced = false;
    for (final profile in _profiles) {
      if (profile.id == nextProfile.id) {
        nextProfiles.add(nextProfile);
        replaced = true;
      } else {
        nextProfiles.add(profile);
      }
    }
    if (!replaced) {
      nextProfiles.insert(0, nextProfile);
    }

    _profiles = nextProfiles;
    _activeProfileId = nextProfile.id;
    _selectedMessageViewKey = null;
    _routeDepth = ProductShellRouteDepth.conversation;
    _surfaceNotice = ProductShellNotice(
      replaced
          ? ProductShellNoticeKind.profileUpdated
          : ProductShellNoticeKind.profileSaved,
      profileName: nextProfile.displayName,
    );
    notifyListeners();
    await _persist();
    await activateProfile(nextProfile.id, persist: false);
  }

  Future<void> deleteProfile(String profileId) async {
    final deletingActive = profileId == _activeProfileId;
    _profiles = _profiles
        .where((profile) => profile.id != profileId)
        .toList(growable: false);
    if (deletingActive) {
      await _detachChatController();
      _activeProfileId = _profiles.isEmpty ? null : _profiles.first.id;
      _selectedMessageViewKey = null;
    }
    _surfaceNotice = const ProductShellNotice(
      ProductShellNoticeKind.profileRemoved,
    );
    notifyListeners();
    await _persist();
    final nextProfileId = _activeProfileId;
    if (deletingActive && nextProfileId != null) {
      await activateProfile(nextProfileId, persist: false);
    }
  }

  Future<void> activateProfile(String profileId, {bool persist = true}) async {
    final profile = _findProfile(profileId);
    if (profile == null) {
      return;
    }
    _activeProfileId = profile.id;
    _selectedMessageViewKey = null;
    _routeDepth = ProductShellRouteDepth.conversation;
    notifyListeners();
    if (persist) {
      await _persist();
    }
    if (!connectOnActivate) {
      return;
    }
    await _connectProfile(profile);
  }

  Future<void> reconnectActiveProfile() async {
    final profile = activeProfile;
    if (profile == null) {
      return;
    }
    await _connectProfile(profile);
  }

  Future<void> disconnectActiveProfile() async {
    await _detachChatController();
    _surfaceNotice = const ProductShellNotice(
      ProductShellNoticeKind.transportDisconnected,
    );
    notifyListeners();
  }

  void openConversation() {
    if (_routeDepth == ProductShellRouteDepth.conversation) {
      return;
    }
    _routeDepth = ProductShellRouteDepth.conversation;
    notifyListeners();
  }

  void openProfileDirectory() {
    _openRouteDepth(ProductShellRouteDepth.profileDirectory);
  }

  void openRoomInspector() {
    _openRouteDepth(ProductShellRouteDepth.roomInspector);
  }

  void openMessageInspector(ChatMessage message) {
    final previousKey = _selectedMessageViewKey;
    _selectedMessageViewKey = message.viewKey;
    if (_routeDepth == ProductShellRouteDepth.messageInspector &&
        previousKey != message.viewKey) {
      notifyListeners();
      return;
    }
    _openRouteDepth(ProductShellRouteDepth.messageInspector);
  }

  void selectMessage(ChatMessage? message) {
    final nextKey = message?.viewKey;
    if (_selectedMessageViewKey == nextKey) {
      return;
    }
    _selectedMessageViewKey = nextKey;
    notifyListeners();
  }

  void _openRouteDepth(ProductShellRouteDepth depth) {
    if (_routeDepth == depth) {
      return;
    }
    _routeDepth = depth;
    notifyListeners();
  }

  String buildShareLink(Uri currentUri) {
    final profile = activeProfile;
    final queryParameters = <String, String>{};
    if (profile != null) {
      queryParameters['url'] = profile.transportUrl.trim();
      final token = profile.accessToken?.trim();
      if (token != null && token.isNotEmpty) {
        queryParameters['token'] = token;
      }
    }
    return currentUri
        .replace(
          queryParameters: queryParameters.isEmpty ? null : queryParameters,
        )
        .toString();
  }

  Future<void> _connectProfile(ConnectionProfile profile) async {
    final controller = ChatViewController(
      transportUrl: profile.transportUrl,
      accessToken: profile.accessToken,
    );
    await _detachChatController();
    controller.addListener(_handleChatControllerChanged);
    _chatController = controller;
    _surfaceNotice = ProductShellNotice(
      ProductShellNoticeKind.transportConnecting,
      profileName: profile.displayName,
    );
    notifyListeners();
    try {
      await controller.connect();
      _surfaceNotice = ProductShellNotice(
        ProductShellNoticeKind.transportConnected,
        profileName: profile.displayName,
      );
    } catch (error) {
      _surfaceNotice = null;
    }
    notifyListeners();
  }

  Future<void> _detachChatController() async {
    final controller = _chatController;
    if (controller == null) {
      return;
    }
    controller.removeListener(_handleChatControllerChanged);
    await controller.disconnect();
    controller.dispose();
    _chatController = null;
  }

  void _handleChatControllerChanged() {
    if (_selectedMessageViewKey != null && selectedMessage == null) {
      _selectedMessageViewKey = null;
    }
    notifyListeners();
  }

  ConnectionProfile? _findProfile(String profileId) {
    for (final profile in _profiles) {
      if (profile.id == profileId) {
        return profile;
      }
    }
    return null;
  }

  ConnectionProfile? _findMatchingProfile(
    String transportUrl,
    String? accessToken,
  ) {
    for (final profile in _profiles) {
      if (profile.matchesTransport(transportUrl, accessToken)) {
        return profile;
      }
    }
    return null;
  }

  Future<void> _persist() {
    return store.save(
      ConnectionProfilesSnapshot(
        profiles: _profiles,
        activeProfileId: _activeProfileId,
      ),
    );
  }

  @override
  void dispose() {
    unawaited(_detachChatController());
    super.dispose();
  }
}
