import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import '../model/product_shell_layout.dart';
import 'ios26_icon_button.dart';
import 'ios26_theme_extension.dart';

List<ChatComposerPlugin> buildProductShellComposerPlugins(
  BuildContext context,
) {
  final l10n = ProductShellLocalizations.of(context);
  return <ChatComposerPlugin>[
    StaticSuggestionPlugin(
      id: 'mentions',
      triggerCharacter: '@',
      items: <StaticSuggestionItem>[
        StaticSuggestionItem(label: '@workspace', detail: l10n.shellSubtitle),
        const StaticSuggestionItem(label: '@README.md', detail: 'Pinned file'),
        const StaticSuggestionItem(label: '@src/', detail: 'Source tree'),
      ],
    ),
    StaticSuggestionPlugin(
      id: 'commands',
      triggerCharacter: '/',
      items: <StaticSuggestionItem>[
        StaticSuggestionItem(label: '/screenshot', detail: l10n.copyShareLink),
        StaticSuggestionItem(label: '/attach', detail: l10n.createProfile),
        StaticSuggestionItem(label: '/help', detail: l10n.detailsTab),
      ],
    ),
    const StaticSuggestionPlugin(
      id: 'skills',
      triggerCharacter: r'$',
      items: <StaticSuggestionItem>[
        StaticSuggestionItem(
          label: r'$message',
          detail: 'Message system skill',
        ),
        StaticSuggestionItem(label: r'$workspace', detail: 'Workspace skill'),
        StaticSuggestionItem(label: r'$terminal', detail: 'Terminal skill'),
      ],
    ),
  ];
}

class ChatStagePanel extends StatelessWidget {
  const ChatStagePanel({
    super.key,
    required this.activeProfile,
    required this.chatController,
    required this.layout,
    required this.selectedMessageViewKey,
    required this.onSelectMessage,
    required this.onCreateProfile,
    required this.onImportProfile,
    required this.onEditProfile,
    required this.onReconnect,
    required this.onDisconnect,
    required this.onShowDetails,
    required this.showDetailsAction,
  });

  final ConnectionProfile? activeProfile;
  final ChatViewController? chatController;
  final ProductShellLayout layout;
  final String? selectedMessageViewKey;
  final ValueChanged<ChatMessage> onSelectMessage;
  final VoidCallback onCreateProfile;
  final VoidCallback onImportProfile;
  final VoidCallback onEditProfile;
  final Future<void> Function() onReconnect;
  final Future<void> Function() onDisconnect;
  final VoidCallback onShowDetails;
  final bool showDetailsAction;

  Future<void> _showStageActions(BuildContext context) async {
    final l10n = ProductShellLocalizations.of(context);
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        title: Text(l10n.profileActions),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(sheetContext).pop();
              onEditProfile();
            },
            child: Text(l10n.editProfile),
          ),
          CupertinoActionSheetAction(
            onPressed: () async {
              Navigator.of(sheetContext).pop();
              await onReconnect();
            },
            child: Text(l10n.reconnect),
          ),
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () async {
              Navigator.of(sheetContext).pop();
              await onDisconnect();
            },
            child: Text(l10n.disconnect),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: Text(l10n.cancel),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    final activeProfile = this.activeProfile;
    if (activeProfile == null) {
      return _StageEmptyState(
        onCreateProfile: onCreateProfile,
        onImportProfile: onImportProfile,
      );
    }
    final chatController = this.chatController;
    if (chatController == null) {
      return _ProfileReadyState(
        profile: activeProfile,
        onReconnect: onReconnect,
        onEditProfile: onEditProfile,
      );
    }
    return AnimatedBuilder(
      animation: chatController,
      builder: (context, child) {
        final state = chatController.state;
        final title = state.channel?.displayTitle ?? activeProfile.displayName;
        final subtitle = state.channel?.chatId ?? activeProfile.hostLabel;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CupertinoListSection.insetGrouped(
              margin: EdgeInsets.zero,
              backgroundColor: CupertinoColors.transparent,
              children: [
                CupertinoListTile.notched(
                  title: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.iosSectionTextStyle,
                  ),
                  subtitle: Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Ios26IconButton(
                    icon: CupertinoIcons.ellipsis_circle,
                    label: l10n.profileActions,
                    onPressed: () => _showStageActions(context),
                    size: 20,
                  ),
                ),
                CupertinoListTile.notched(
                  title: Text(l10n.connectionSectionTitle),
                  subtitle: Text(
                    l10n.connectionSummary(
                      l10n.connectionLabel(state.connectionState.name),
                      state.focused ? l10n.focused : l10n.background,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  additionalInfo: Text(
                    activeProfile.accessToken == null
                        ? l10n.noUploadToken
                        : l10n.uploadReady,
                    style: context.iosFootnoteTextStyle,
                  ),
                  trailing: showDetailsAction
                      ? const Icon(CupertinoIcons.chevron_forward, size: 18)
                      : null,
                  onTap: showDetailsAction ? onShowDetails : null,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: ColoredBox(
                  color: CupertinoDynamicColor.resolve(
                    CupertinoColors.secondarySystemGroupedBackground,
                    context,
                  ),
                  child: FlutterChatView(
                    controller: chatController,
                    plugins: buildProductShellComposerPlugins(context),
                    compactComposerLayout: layout.isCompact,
                    selectedMessageViewKey: selectedMessageViewKey,
                    onMessageSelected: onSelectMessage,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _StageEmptyState extends StatelessWidget {
  const _StageEmptyState({
    required this.onCreateProfile,
    required this.onImportProfile,
  });

  final VoidCallback onCreateProfile;
  final VoidCallback onImportProfile;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: CupertinoListSection.insetGrouped(
          margin: EdgeInsets.zero,
          backgroundColor: CupertinoColors.transparent,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    CupertinoIcons.chat_bubble_2,
                    size: 34,
                    color: CupertinoTheme.of(context).primaryColor,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    l10n.conversationStageTitle,
                    style: context.iosTitleTextStyle,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    l10n.conversationStageBody,
                    textAlign: TextAlign.center,
                    style: context.iosCaptionTextStyle,
                  ),
                  const SizedBox(height: 16),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        CupertinoButton.filled(
                          onPressed: onCreateProfile,
                          child: Text(l10n.newProfile),
                        ),
                        const SizedBox(height: 8),
                        CupertinoButton(
                          onPressed: onImportProfile,
                          child: Text(l10n.importUrlAndToken),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    l10n.sharedLinkContract,
                    textAlign: TextAlign.center,
                    style: context.iosFootnoteTextStyle,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileReadyState extends StatelessWidget {
  const _ProfileReadyState({
    required this.profile,
    required this.onReconnect,
    required this.onEditProfile,
  });

  final ConnectionProfile profile;
  final Future<void> Function() onReconnect;
  final VoidCallback onEditProfile;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: CupertinoListSection.insetGrouped(
          margin: EdgeInsets.zero,
          backgroundColor: CupertinoColors.transparent,
          children: [
            CupertinoListTile.notched(
              title: Text(
                profile.displayName,
                style: context.iosEmphasisTextStyle,
              ),
              subtitle: Text(profile.hostLabel),
            ),
            CupertinoListTile.notched(
              title: Text(l10n.profileImported),
              subtitle: Text(l10n.shellSubtitle),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  CupertinoButton.filled(
                    onPressed: () => onReconnect(),
                    child: Text(l10n.connect),
                  ),
                  CupertinoButton(
                    onPressed: onEditProfile,
                    child: Text(l10n.editProfile),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
