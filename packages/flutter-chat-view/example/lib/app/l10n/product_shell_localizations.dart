import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../model/product_shell_notice.dart';

class ProductShellLocalizations {
  ProductShellLocalizations(this.locale);

  final Locale locale;

  static const LocalizationsDelegate<ProductShellLocalizations> delegate =
      _ProductShellLocalizationsDelegate();

  static ProductShellLocalizations of(BuildContext context) {
    return Localizations.of<ProductShellLocalizations>(
          context,
          ProductShellLocalizations,
        ) ??
        ProductShellLocalizations(const Locale('en'));
  }

  bool get _isZhHans =>
      locale.languageCode == 'zh' &&
      (locale.scriptCode == 'Hans' || locale.countryCode == 'CN');

  String get appTitle => 'Agenter Chat';
  String get bootstrappingShell =>
      _isZhHans ? '正在准备产品壳层' : 'Preparing product shell';
  String get deleteProfileTitle => _isZhHans ? '删除配置？' : 'Delete profile?';
  String get deleteProfileBody => _isZhHans
      ? '这会从独立产品壳中移除已保存的房间目标。'
      : 'This removes the saved room target from the standalone shell.';
  String get cancel => _isZhHans ? '取消' : 'Cancel';
  String get delete => _isZhHans ? '删除' : 'Delete';
  String get shareLinkCopied => _isZhHans ? '分享链接已复制。' : 'Share link copied.';
  String get shellEyebrow => _isZhHans ? 'Cupertino 壳层' : 'Cupertino shell';
  String get shellSubtitle =>
      _isZhHans ? 'Web 优先的独立房间工作台' : 'Web-first standalone room surface';
  String get noActiveRoom => _isZhHans ? '暂无活动房间' : 'No active room';
  String get importUrlAndToken =>
      _isZhHans ? '导入 url + token' : 'Import url + token';
  String get importDialogBody => _isZhHans
      ? '输入房间传输 URL 和访问令牌，产品壳会把它持久化为可复用的房间配置。'
      : 'Enter the room transport URL and access token. The shell will persist them as a reusable room target.';
  String get copyShareLink => _isZhHans ? '复制分享链接' : 'Copy share link';
  String get editProfile => _isZhHans ? '编辑配置' : 'Edit profile';
  String get newProfile => _isZhHans ? '新建配置' : 'New profile';
  String get profilesTab => _isZhHans ? '配置' : 'Profiles';
  String get chatTab => _isZhHans ? '聊天' : 'Chat';
  String get detailsTab => _isZhHans ? '详情' : 'Details';
  String get directoryEyebrow => _isZhHans ? '目录' : 'Directory';
  String get profilesTitle => _isZhHans ? '房间配置' : 'Profiles';
  String get profilesSubtitle => _isZhHans ? '已保存的房间目标' : 'Saved room targets';
  String get createProfile => _isZhHans ? '创建配置' : 'Create profile';
  String get emptyProfilesTitle =>
      _isZhHans ? '还没有保存的房间配置' : 'No saved room profiles';
  String get emptyProfilesBody => _isZhHans
      ? '创建一个连接配置，让这个目录之后可以重新打开同一个房间。'
      : 'Create a connection profile so the product shell can reopen the same room without turning the conversation stage back into a credential form.';
  String get profilesEmptyFollowStageHint => _isZhHans
      ? '首次创建或导入在主舞台完成，这里只列出已保存目标。'
      : 'First-run create and import happens on the stage. This rail only lists saved targets.';
  String get activeProfilePill => _isZhHans ? '当前' : 'Active';
  String get profileActions => _isZhHans ? '配置操作' : 'Profile actions';
  String get edit => _isZhHans ? '编辑' : 'Edit';
  String get roomDetailEmpty => _isZhHans
      ? '激活配置后，房间详情会显示在这里。'
      : 'Room detail surfaces appear here once a profile is active.';
  String get roomDetailPassiveHint => _isZhHans
      ? '先在主舞台创建或导入配置，再回来看房间事实。'
      : 'Create or import a profile from the stage, then review room facts here.';
  String get roomSectionTitle => _isZhHans ? '房间' : 'Room';
  String get connectionSectionTitle => _isZhHans ? '连接' : 'Connection';
  String get participantsSectionTitle => _isZhHans ? '参与者' : 'Participants';
  String get participantsEmptyBody =>
      _isZhHans ? '当前房间还没有可见参与者。' : 'No visible participants yet.';
  String get profileSectionTitle => _isZhHans ? '配置' : 'Profile';
  String get selectedMessageSectionTitle =>
      _isZhHans ? '选中消息' : 'Selected message';
  String get messageFactsLabel => _isZhHans ? '消息事实' : 'Message facts';
  String get selectedMessageEmptyBody => _isZhHans
      ? '选择一条消息以查看局部事实。'
      : 'Select a transcript row to inspect message-local facts.';
  String get clear => _isZhHans ? '清除' : 'Clear';
  String get attachments => _isZhHans ? '附件' : 'Attachments';
  String get copyAssetUrl => _isZhHans ? '复制资源 URL' : 'Copy asset URL';
  String get profileImported => _isZhHans ? '配置已导入' : 'Profile imported';
  String get connect => _isZhHans ? '连接' : 'Connect';
  String get conversationStageTitle =>
      _isZhHans ? '会话优先的房间主舞台' : 'Conversation-first room stage';
  String get conversationStageBody => _isZhHans
      ? '选择或创建一个连接配置来打开房间。主舞台只保留给当前会话。'
      : 'Choose or create a connection profile to open a room. The main stage stays reserved for the active conversation instead of a permanent credential form.';
  String get sharedLinkContract => _isZhHans
      ? '带 ?url=<transport>&token=<accessToken> 的链接会自动导入房间配置。'
      : 'Open a link with ?url=<transport>&token=<accessToken> to import a room profile automatically.';
  String get showDetails => _isZhHans ? '显示详情' : 'Show details';
  String get reconnect => _isZhHans ? '重新连接' : 'Reconnect';
  String get disconnect => _isZhHans ? '断开连接' : 'Disconnect';
  String get focused => _isZhHans ? '前台聚焦' : 'Focused';
  String get background => _isZhHans ? '后台' : 'Background';
  String get noUploadToken => _isZhHans ? '没有上传令牌' : 'No upload token';
  String get uploadReady => _isZhHans ? '可上传附件' : 'Upload ready';
  String get roomProfileDialogTitle =>
      _isZhHans ? '编辑连接配置' : 'Edit connection profile';
  String get newProfileDialogTitle =>
      _isZhHans ? '新建连接配置' : 'New connection profile';
  String get profileDialogBody => _isZhHans
      ? '配置会持久化房间传输目标，让对话画布始终聚焦当前房间，而不是反复录入凭证。'
      : 'Profiles persist room transport targets so the conversation canvas stays focused on the active room instead of re-entering credentials.';
  String get profileNameLabel => _isZhHans ? '配置名称' : 'Profile name';
  String get profileNameHint => _isZhHans ? '客户支持房间' : 'Customer support room';
  String get profileNameRequired =>
      _isZhHans ? '配置名称不能为空。' : 'Profile name is required.';
  String get transportUrlLabel => _isZhHans ? '传输 URL' : 'Transport URL';
  String get transportUrlRequired =>
      _isZhHans ? '传输 URL 不能为空。' : 'Transport URL is required.';
  String get transportUrlInvalid =>
      _isZhHans ? '请输入合法的 websocket URL。' : 'Enter a valid websocket URL.';
  String get accessTokenLabel => _isZhHans ? '访问令牌' : 'Access token';
  String get saveProfile => _isZhHans ? '保存配置' : 'Save profile';
  String get createProfileAction => _isZhHans ? '创建配置' : 'Create profile';
  String get copyAssetUrlFeedback =>
      _isZhHans ? '资源链接已复制。' : 'Asset URL copied.';

  String rowLabel(int rowId) => _isZhHans ? '行 $rowId' : 'Row $rowId';
  String messageLabel(int messageId) =>
      _isZhHans ? '消息 $messageId' : 'Message $messageId';

  String createdAtLabel(BuildContext context, int timestamp) {
    final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp).toLocal();
    final localeName = Localizations.localeOf(context).toLanguageTag();
    final timeFormat =
        (MediaQuery.maybeOf(context)?.alwaysUse24HourFormat ?? false)
        ? DateFormat.Hm(localeName)
        : DateFormat.jm(localeName);
    final value =
        '${DateFormat.yMMMMEEEEd(localeName).format(dateTime)} ${timeFormat.format(dateTime)}';
    return _isZhHans ? '创建于 $value' : 'Created $value';
  }

  String attachmentMeta(String kind, String mimeType, int sizeBytes) {
    return _isZhHans
        ? '$kind · $mimeType · $sizeBytes 字节'
        : '$kind · $mimeType · $sizeBytes bytes';
  }

  String readByLabel(List<String> actorIds) {
    final value = actorIds.isEmpty
        ? (_isZhHans ? '无' : 'none')
        : actorIds.join(', ');
    return _isZhHans ? '已读: $value' : 'Read by: $value';
  }

  String unreadByLabel(List<String> actorIds) {
    final value = actorIds.isEmpty
        ? (_isZhHans ? '无' : 'none')
        : actorIds.join(', ');
    return _isZhHans ? '未读: $value' : 'Unread: $value';
  }

  String connectionLabel(String value) {
    return switch (value) {
      'idle' => _isZhHans ? '空闲' : 'Idle',
      'connecting' => _isZhHans ? '连接中' : 'Connecting',
      'connected' => _isZhHans ? '已连接' : 'Connected',
      'closed' => _isZhHans ? '已关闭' : 'Closed',
      'error' => _isZhHans ? '错误' : 'Error',
      _ => value,
    };
  }

  String connectionSummary(String status, String focusState) {
    return '$status · $focusState';
  }

  String notice(ProductShellNotice notice) {
    final profileName = notice.profileName ?? '';
    return switch (notice.kind) {
      ProductShellNoticeKind.importedSharedRoomLink =>
        _isZhHans ? '已导入共享房间链接。' : 'Imported shared room link.',
      ProductShellNoticeKind.loadedSharedRoomLink =>
        _isZhHans ? '已加载共享房间链接。' : 'Loaded shared room link.',
      ProductShellNoticeKind.profileSaved =>
        _isZhHans ? '已保存 $profileName。' : 'Saved $profileName.',
      ProductShellNoticeKind.profileUpdated =>
        _isZhHans ? '已更新 $profileName。' : 'Updated $profileName.',
      ProductShellNoticeKind.profileRemoved =>
        _isZhHans ? '已移除连接配置。' : 'Removed connection profile.',
      ProductShellNoticeKind.transportDisconnected =>
        _isZhHans ? '已断开房间传输。' : 'Disconnected room transport.',
      ProductShellNoticeKind.transportConnecting =>
        _isZhHans ? '正在连接到 $profileName…' : 'Connecting to $profileName...',
      ProductShellNoticeKind.transportConnected =>
        _isZhHans ? '已连接到 $profileName。' : 'Connected to $profileName.',
    };
  }
}

class _ProductShellLocalizationsDelegate
    extends LocalizationsDelegate<ProductShellLocalizations> {
  const _ProductShellLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return locale.languageCode == 'en' || locale.languageCode == 'zh';
  }

  @override
  Future<ProductShellLocalizations> load(Locale locale) {
    return SynchronousFuture(ProductShellLocalizations(locale));
  }

  @override
  bool shouldReload(_ProductShellLocalizationsDelegate old) => false;
}
