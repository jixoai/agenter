import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../controller/product_shell_controller.dart';
import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import '../model/product_shell_layout.dart';
import 'chat_stage_panel.dart';
import 'connection_profile_sheet.dart';
import 'detail_rail.dart';
import 'ios26_icon_button.dart';
import 'ios26_surfaces.dart';
import 'profile_rail.dart';

class ProductShellPage extends StatelessWidget {
  const ProductShellPage({super.key, required this.controller});

  final ProductShellController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        if (controller.bootstrapping) {
          return const _BootstrappingShell();
        }
        return LayoutBuilder(
          builder: (context, constraints) {
            final layout = resolveProductShellLayout(constraints.maxWidth);
            final l10n = ProductShellLocalizations.of(context);
            return CallbackShortcuts(
              bindings: <ShortcutActivator, VoidCallback>{
                const SingleActivator(
                  LogicalKeyboardKey.digit1,
                  alt: true,
                ): () =>
                    controller.setCompactTab(ProductShellTab.profiles),
                const SingleActivator(
                  LogicalKeyboardKey.digit2,
                  alt: true,
                ): () =>
                    controller.setCompactTab(ProductShellTab.conversation),
                const SingleActivator(
                  LogicalKeyboardKey.digit3,
                  alt: true,
                ): () =>
                    controller.setCompactTab(ProductShellTab.details),
                const SingleActivator(LogicalKeyboardKey.escape): () {
                  controller.selectMessage(null);
                  controller.setCompactTab(ProductShellTab.conversation);
                },
                if (controller.activeProfile != null)
                  const SingleActivator(
                    LogicalKeyboardKey.keyC,
                    alt: true,
                  ): () =>
                      _copyShareLink(context),
              },
              child: Focus(
                autofocus: true,
                child: CupertinoPageScaffold(
                  navigationBar: CupertinoNavigationBar(
                    border: null,
                    backgroundColor: CupertinoTheme.of(
                      context,
                    ).barBackgroundColor.withValues(alpha: 0.92),
                    middle: Text(l10n.appTitle),
                    trailing: Ios26IconButton(
                      icon: CupertinoIcons.add_circled,
                      label: l10n.newProfile,
                      onPressed: () => _showCreateActions(context),
                      size: 28,
                    ),
                  ),
                  child: SafeArea(
                    top: false,
                    bottom: false,
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        layout.showsBottomNavigation ? 28 : 34,
                        16,
                        layout.showsBottomNavigation ? 8 : 16,
                      ),
                      child: Column(
                        children: [
                          Expanded(
                            child: Align(
                              alignment: Alignment.topCenter,
                              child: ConstrainedBox(
                                constraints: BoxConstraints(
                                  maxWidth: _contentMaxWidth(layout),
                                ),
                                child: switch (layout) {
                                  ProductShellLayout.compact =>
                                    _buildCompactLayout(context),
                                  ProductShellLayout.standard =>
                                    _buildStandardLayout(context),
                                  ProductShellLayout.expanded =>
                                    _buildExpandedLayout(context),
                                },
                              ),
                            ),
                          ),
                          if (layout.showsBottomNavigation) ...[
                            SafeArea(
                              top: false,
                              left: false,
                              right: false,
                              child: Padding(
                                padding: const EdgeInsets.only(top: 12),
                                child: _CompactNavigationBar(
                                  selectedTab: controller.compactTab,
                                  onSelected: controller.setCompactTab,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildExpandedLayout(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final profileWidth = (constraints.maxWidth * 0.21).clamp(276.0, 312.0);
        final detailWidth = (constraints.maxWidth * 0.22).clamp(292.0, 332.0);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: profileWidth,
              child: ProfileRail(
                profiles: controller.profiles,
                activeProfileId: controller.activeProfileId,
                surfaceNotice: controller.surfaceNotice,
                onCreateProfile: () => _showProfileEditor(context),
                onImportProfile: () => _showImportProfileSheet(context),
                showEmptyActions: false,
                onActivateProfile: controller.activateProfile,
                onEditProfile: (profile) =>
                    _showProfileEditor(context, initialProfile: profile),
                onDeleteProfile: (profileId) =>
                    _confirmDeleteProfile(context, profileId),
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              flex: 3,
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 940),
                  child: ChatStagePanel(
                    activeProfile: controller.activeProfile,
                    chatController: controller.chatController,
                    layout: ProductShellLayout.expanded,
                    selectedMessageViewKey: controller.selectedMessage?.viewKey,
                    onSelectMessage: controller.selectMessage,
                    onCreateProfile: () => _showProfileEditor(context),
                    onImportProfile: () => _showImportProfileSheet(context),
                    onEditProfile: () => _showProfileEditor(
                      context,
                      initialProfile: controller.activeProfile,
                    ),
                    onReconnect: controller.reconnectActiveProfile,
                    onDisconnect: controller.disconnectActiveProfile,
                    onShowDetails: () {},
                    showDetailsAction: false,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 20),
            SizedBox(
              width: detailWidth,
              child: DetailRail(
                activeProfile: controller.activeProfile,
                chatController: controller.chatController,
                selectedMessage: controller.selectedMessage,
                onCopyShareLink: () => _copyShareLink(context),
                onClearSelectedMessage: () => controller.selectMessage(null),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildStandardLayout(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final railWidth = (constraints.maxWidth * 0.31).clamp(272.0, 308.0);
        final detailHeight = (constraints.maxHeight * 0.31).clamp(228.0, 292.0);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: railWidth,
              child: ProfileRail(
                profiles: controller.profiles,
                activeProfileId: controller.activeProfileId,
                surfaceNotice: controller.surfaceNotice,
                onCreateProfile: () => _showProfileEditor(context),
                onImportProfile: () => _showImportProfileSheet(context),
                showEmptyActions: false,
                onActivateProfile: controller.activateProfile,
                onEditProfile: (profile) =>
                    _showProfileEditor(context, initialProfile: profile),
                onDeleteProfile: (profileId) =>
                    _confirmDeleteProfile(context, profileId),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: ChatStagePanel(
                      activeProfile: controller.activeProfile,
                      chatController: controller.chatController,
                      layout: ProductShellLayout.standard,
                      selectedMessageViewKey:
                          controller.selectedMessage?.viewKey,
                      onSelectMessage: controller.selectMessage,
                      onCreateProfile: () => _showProfileEditor(context),
                      onImportProfile: () => _showImportProfileSheet(context),
                      onEditProfile: () => _showProfileEditor(
                        context,
                        initialProfile: controller.activeProfile,
                      ),
                      onReconnect: controller.reconnectActiveProfile,
                      onDisconnect: controller.disconnectActiveProfile,
                      onShowDetails: () {},
                      showDetailsAction: false,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: detailHeight,
                    child: DetailRail(
                      activeProfile: controller.activeProfile,
                      chatController: controller.chatController,
                      selectedMessage: controller.selectedMessage,
                      onCopyShareLink: () => _copyShareLink(context),
                      onClearSelectedMessage: () =>
                          controller.selectMessage(null),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCompactLayout(BuildContext context) {
    final pages = <Widget>[
      ProfileRail(
        profiles: controller.profiles,
        activeProfileId: controller.activeProfileId,
        surfaceNotice: controller.surfaceNotice,
        onCreateProfile: () => _showProfileEditor(context),
        onImportProfile: () => _showImportProfileSheet(context),
        onActivateProfile: (profileId) async {
          await controller.activateProfile(profileId);
          controller.setCompactTab(ProductShellTab.conversation);
        },
        onEditProfile: (profile) =>
            _showProfileEditor(context, initialProfile: profile),
        onDeleteProfile: (profileId) =>
            _confirmDeleteProfile(context, profileId),
      ),
      ChatStagePanel(
        activeProfile: controller.activeProfile,
        chatController: controller.chatController,
        layout: ProductShellLayout.compact,
        selectedMessageViewKey: controller.selectedMessage?.viewKey,
        onSelectMessage: (message) {
          controller.selectMessage(message);
          controller.setCompactTab(ProductShellTab.details);
        },
        onCreateProfile: () => _showProfileEditor(context),
        onImportProfile: () => _showImportProfileSheet(context),
        onEditProfile: () => _showProfileEditor(
          context,
          initialProfile: controller.activeProfile,
        ),
        onReconnect: controller.reconnectActiveProfile,
        onDisconnect: controller.disconnectActiveProfile,
        onShowDetails: () => controller.setCompactTab(ProductShellTab.details),
        showDetailsAction: true,
      ),
      DetailRail(
        activeProfile: controller.activeProfile,
        chatController: controller.chatController,
        selectedMessage: controller.selectedMessage,
        onCopyShareLink: () => _copyShareLink(context),
        onClearSelectedMessage: () => controller.selectMessage(null),
      ),
    ];
    return IndexedStack(index: controller.compactTab.index, children: pages);
  }

  Future<void> _showCreateActions(BuildContext context) async {
    final l10n = ProductShellLocalizations.of(context);
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(sheetContext).pop();
              _showProfileEditor(context);
            },
            child: Text(l10n.newProfile),
          ),
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(sheetContext).pop();
              _showImportProfileSheet(context);
            },
            child: Text(l10n.importUrlAndToken),
          ),
        ],
        cancelButton: CupertinoActionSheetAction(
          onPressed: () => Navigator.of(sheetContext).pop(),
          child: Text(l10n.cancel),
        ),
      ),
    );
  }

  Future<void> _showProfileEditor(
    BuildContext context, {
    ConnectionProfile? initialProfile,
  }) async {
    final draft = await showConnectionProfileSheet(
      context,
      initialProfile: initialProfile,
    );
    if (draft == null) {
      return;
    }
    await controller.saveProfile(draft, profileId: initialProfile?.id);
  }

  Future<void> _showImportProfileSheet(BuildContext context) async {
    final draft = await showImportConnectionProfileSheet(context);
    if (draft == null) {
      return;
    }
    await controller.saveProfile(draft);
  }

  Future<void> _confirmDeleteProfile(
    BuildContext context,
    String profileId,
  ) async {
    final l10n = ProductShellLocalizations.of(context);
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: Text(l10n.deleteProfileTitle),
        content: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(l10n.deleteProfileBody),
        ),
        actions: [
          CupertinoDialogAction(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.delete),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    await controller.deleteProfile(profileId);
  }

  Future<void> _copyShareLink(BuildContext context) async {
    final l10n = ProductShellLocalizations.of(context);
    final link = controller.buildShareLink(Uri.base);
    await Clipboard.setData(ClipboardData(text: link));
    if (!context.mounted) {
      return;
    }
    await showIos26Toast(context, l10n.shareLinkCopied);
  }
}

class _BootstrappingShell extends StatelessWidget {
  const _BootstrappingShell();

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return CupertinoPageScaffold(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CupertinoActivityIndicator(radius: 10),
            const SizedBox(height: 12),
            Text(l10n.bootstrappingShell),
          ],
        ),
      ),
    );
  }
}

class _CompactNavigationBar extends StatelessWidget {
  const _CompactNavigationBar({
    required this.selectedTab,
    required this.onSelected,
  });

  final ProductShellTab selectedTab;
  final ValueChanged<ProductShellTab> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return CupertinoTabBar(
      currentIndex: selectedTab.index,
      onTap: (index) => onSelected(ProductShellTab.values[index]),
      items: <BottomNavigationBarItem>[
        BottomNavigationBarItem(
          icon: const Icon(CupertinoIcons.square_grid_2x2),
          label: l10n.profilesTab,
        ),
        BottomNavigationBarItem(
          icon: const Icon(CupertinoIcons.chat_bubble_2),
          label: l10n.chatTab,
        ),
        BottomNavigationBarItem(
          icon: const Icon(CupertinoIcons.info_circle),
          label: l10n.detailsTab,
        ),
      ],
    );
  }
}

double _contentMaxWidth(ProductShellLayout layout) {
  return switch (layout) {
    ProductShellLayout.compact => double.infinity,
    ProductShellLayout.standard => 1320,
    ProductShellLayout.expanded => 1600,
  };
}
