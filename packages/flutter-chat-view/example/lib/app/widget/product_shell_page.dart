import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../controller/product_shell_controller.dart';
import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import '../model/product_shell_layout.dart';
import 'connection_profile_sheet.dart';
import 'apple_icon_button.dart';
import 'apple_platform_theme.dart';
import 'apple_surfaces.dart';
import 'product_shell_route_layout.dart';
import 'product_shell_route_sheets.dart';

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
                    _showProfileDirectory(context),
                const SingleActivator(
                  LogicalKeyboardKey.digit2,
                  alt: true,
                ): () {
                  controller.openConversation();
                  Navigator.of(context).maybePop();
                },
                const SingleActivator(
                  LogicalKeyboardKey.digit3,
                  alt: true,
                ): () =>
                    _showRoomInspector(context),
                const SingleActivator(LogicalKeyboardKey.escape): () {
                  controller.selectMessage(null);
                  controller.openConversation();
                  Navigator.of(context).maybePop();
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
                    leading: layout.isCompact
                        ? AppleIconButton(
                            icon: CupertinoIcons.square_grid_2x2,
                            label: l10n.profilesTab,
                            onPressed: () => _showProfileDirectory(context),
                          )
                        : null,
                    middle: Text(l10n.appTitle),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (layout.isCompact &&
                            controller.activeProfile != null)
                          AppleIconButton(
                            icon: CupertinoIcons.info_circle,
                            label: l10n.showDetails,
                            onPressed: () => _showRoomInspector(context),
                          ),
                        AppleIconButton(
                          icon: CupertinoIcons.add_circled,
                          label: l10n.newProfile,
                          onPressed: () => _showCreateActions(context),
                          size: 28,
                        ),
                      ],
                    ),
                  ),
                  child: SafeArea(
                    top: true,
                    bottom: false,
                    child: Padding(
                      padding: appleShellMargins(context),
                      child: Align(
                        alignment: Alignment.topCenter,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            maxWidth: _contentMaxWidth(layout),
                          ),
                          child: ProductShellRouteLayout(
                            controller: controller,
                            layout: layout,
                            onEditProfile: ({initialProfile}) =>
                                _showProfileEditor(
                                  context,
                                  initialProfile: initialProfile,
                                ),
                            onImportProfile: () =>
                                _showImportProfileSheet(context),
                            onDeleteProfile: (profileId) =>
                                _confirmDeleteProfile(context, profileId),
                            onCopyShareLink: () => _copyShareLink(context),
                            onShowRoomInspector: () =>
                                _showRoomInspector(context),
                            onShowMessageInspector: (message) =>
                                _showMessageInspector(context, message),
                          ),
                        ),
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

  Future<void> _showProfileDirectory(BuildContext context) async {
    controller.openProfileDirectory();
    await showProductShellProfileDirectorySheet(
      context,
      controller: controller,
      onCreateProfile: () => _showProfileEditor(context),
      onImportProfile: () => _showImportProfileSheet(context),
      onEditProfile: (profile) =>
          _showProfileEditor(context, initialProfile: profile),
      onDeleteProfile: _confirmDeleteProfile,
    );
    controller.openConversation();
  }

  Future<void> _showRoomInspector(BuildContext context) async {
    controller.openRoomInspector();
    await showProductShellRoomInspectorSheet(
      context,
      controller: controller,
      onCopyShareLink: _copyShareLink,
    );
    controller.openConversation();
  }

  Future<void> _showMessageInspector(
    BuildContext context,
    ChatMessage message,
  ) async {
    controller.openMessageInspector(message);
    await showProductShellMessageInspectorSheet(
      context,
      controller: controller,
      onCopyShareLink: _copyShareLink,
    );
    controller.openConversation();
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
    await showAppleToast(context, l10n.shareLinkCopied);
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

double _contentMaxWidth(ProductShellLayout layout) {
  return switch (layout) {
    ProductShellLayout.compact => double.infinity,
    ProductShellLayout.standard => 1320,
    ProductShellLayout.expanded => 1600,
  };
}
