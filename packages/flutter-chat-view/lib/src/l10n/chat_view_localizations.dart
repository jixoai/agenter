import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

class ChatViewLocalizations {
  ChatViewLocalizations(this.locale);

  final Locale locale;

  static const LocalizationsDelegate<ChatViewLocalizations> delegate =
      _ChatViewLocalizationsDelegate();

  static ChatViewLocalizations of(BuildContext context) {
    return Localizations.of<ChatViewLocalizations>(
          context,
          ChatViewLocalizations,
        ) ??
        ChatViewLocalizations(const Locale('en'));
  }

  bool get _isZhHans =>
      locale.languageCode == 'zh' &&
      (locale.scriptCode == 'Hans' || locale.countryCode == 'CN');

  String get retry => _isZhHans ? '重试' : 'Retry';
  String get connectionFailedTitle =>
      _isZhHans ? '无法连接房间' : 'Couldn\'t connect';
  String get connectionFailedBody => _isZhHans
      ? '检查房间 URL 和访问令牌后再试。'
      : 'Check the room URL and access token, then try again.';
  String get disconnectedTitle => _isZhHans ? '连接已断开' : 'Connection lost';
  String get disconnectedBody => _isZhHans
      ? '房间传输当前不可用，请重新连接。'
      : 'Room transport is currently unavailable. Reconnect to continue.';
  String get uploadRequiresTokenTitle =>
      _isZhHans ? '缺少上传令牌' : 'Missing upload token';
  String get uploadRequiresTokenBody => _isZhHans
      ? '当前配置没有上传令牌，因此无法发送附件。'
      : 'This profile does not include an upload token, so attachments cannot be sent.';
  String get uploadFailedTitle => _isZhHans ? '附件上传失败' : 'Upload failed';
  String get uploadFailedBody => _isZhHans
      ? '附件没有上传成功，请稍后重试。'
      : 'The attachment did not upload successfully. Try again in a moment.';
  String get loadOlderMessages => _isZhHans ? '加载更早消息' : 'Load older messages';
  String get latest => _isZhHans ? '最新位置' : 'Latest';
  String get transcriptEmptyTitle =>
      _isZhHans ? '还没有房间消息' : 'No room messages yet';
  String get transcriptEmptyBody => _isZhHans
      ? '发送第一条消息，开始当前会话。'
      : 'Send the first message to start the conversation stage.';
  String get attachFiles => _isZhHans ? '添加文件' : 'Attach files';
  String composerHint({required bool editing}) => editing
      ? (_isZhHans ? '编辑消息…' : 'Edit message…')
      : (_isZhHans ? '发送房间消息…' : 'Message room…');
  String actionLabel({required bool editing}) =>
      editing ? (_isZhHans ? '保存' : 'Save') : (_isZhHans ? '发送' : 'Send');
  String get cancel => _isZhHans ? '取消' : 'Cancel';
  String get viewerFallbackName => _isZhHans ? '用户' : 'User';
  String get you => _isZhHans ? '你' : 'You';
  String get edited => _isZhHans ? '已编辑' : 'Edited';
  String get recalled => _isZhHans ? '已撤回' : 'Recalled';
  String get copyText => _isZhHans ? '复制文本' : 'Copy text';
  String get editMessage => _isZhHans ? '编辑消息' : 'Edit';
  String get recallMessage => _isZhHans ? '撤回消息' : 'Recall';
  String get emptyMessagePreview => _isZhHans ? '[空消息]' : '[empty message]';
  String get defaultErrorTitle => _isZhHans ? '错误' : 'Error';
  String get interactiveFallbackTitle => _isZhHans ? '交互卡片' : 'Interactive';
  String get interactiveSubmit => _isZhHans ? '提交' : 'Submit';
  String get recalledMessageText =>
      _isZhHans ? '这条消息已被撤回。' : 'This message was recalled.';

  String readCount(int readCount, int totalCount) {
    return _isZhHans
        ? '已读 $readCount / $totalCount'
        : 'Read $readCount / $totalCount';
  }
}

class _ChatViewLocalizationsDelegate
    extends LocalizationsDelegate<ChatViewLocalizations> {
  const _ChatViewLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) {
    return locale.languageCode == 'en' || locale.languageCode == 'zh';
  }

  @override
  Future<ChatViewLocalizations> load(Locale locale) {
    return SynchronousFuture(ChatViewLocalizations(locale));
  }

  @override
  bool shouldReload(_ChatViewLocalizationsDelegate old) => false;
}

String formatChatDividerLabel(BuildContext context, int timestamp) {
  final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp).toLocal();
  final localeName = Localizations.localeOf(context).toLanguageTag();
  final timeFormat =
      (MediaQuery.maybeOf(context)?.alwaysUse24HourFormat ?? false)
      ? DateFormat.Hm(localeName)
      : DateFormat.jm(localeName);
  return '${DateFormat.yMMMd(localeName).format(dateTime)} · ${timeFormat.format(dateTime)}';
}

String formatChatTimestamp(BuildContext context, int timestamp) {
  final dateTime = DateTime.fromMillisecondsSinceEpoch(timestamp).toLocal();
  final localeName = Localizations.localeOf(context).toLanguageTag();
  final timeFormat =
      (MediaQuery.maybeOf(context)?.alwaysUse24HourFormat ?? false)
      ? DateFormat.Hm(localeName)
      : DateFormat.jm(localeName);
  return '${DateFormat.yMd(localeName).format(dateTime)} ${timeFormat.format(dateTime)}';
}
