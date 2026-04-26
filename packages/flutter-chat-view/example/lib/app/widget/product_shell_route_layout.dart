import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../controller/product_shell_controller.dart';
import '../model/connection_profile.dart';
import '../model/product_shell_layout.dart';
import 'chat_stage_panel.dart';
import 'detail_rail.dart';
import 'apple_platform_theme.dart';
import 'apple_surfaces.dart';
import 'profile_rail.dart';

class ProductShellRouteLayout extends StatelessWidget {
  const ProductShellRouteLayout({
    super.key,
    required this.controller,
    required this.layout,
    required this.onEditProfile,
    required this.onImportProfile,
    required this.onDeleteProfile,
    required this.onCopyShareLink,
    required this.onShowRoomInspector,
    required this.onShowMessageInspector,
  });

  final ProductShellController controller;
  final ProductShellLayout layout;
  final void Function({ConnectionProfile? initialProfile}) onEditProfile;
  final VoidCallback onImportProfile;
  final ValueChanged<String> onDeleteProfile;
  final VoidCallback onCopyShareLink;
  final VoidCallback onShowRoomInspector;
  final ValueChanged<ChatMessage> onShowMessageInspector;

  @override
  Widget build(BuildContext context) {
    return switch (layout) {
      ProductShellLayout.compact => _buildCompactLayout(context),
      ProductShellLayout.standard => _buildStandardLayout(context),
      ProductShellLayout.expanded => _buildExpandedLayout(context),
    };
  }

  Widget _buildExpandedLayout(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final tokens = appleTokens(context);
        final profileWidth = (constraints.maxWidth * 0.21).clamp(280.0, 320.0);
        final detailWidth = (constraints.maxWidth * 0.22).clamp(300.0, 340.0);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: profileWidth,
              child: AppleMaterialSurface(
                role: AppleSurfaceRole.sidebar,
                child: _buildProfileRail(showEmptyActions: false),
              ),
            ),
            SizedBox(width: tokens.columnGap),
            Expanded(
              flex: 3,
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 940),
                  child: AppleMaterialSurface(
                    role: AppleSurfaceRole.content,
                    child: _buildChatStage(
                      layout: ProductShellLayout.expanded,
                      onSelectMessage: controller.selectMessage,
                      showDetailsAction: false,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(width: tokens.columnGap),
            SizedBox(
              width: detailWidth,
              child: AppleMaterialSurface(
                role: AppleSurfaceRole.inspector,
                child: _buildDetailRail(),
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
        final tokens = appleTokens(context);
        final railWidth = (constraints.maxWidth * 0.31).clamp(276.0, 316.0);
        return Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: railWidth,
              child: AppleMaterialSurface(
                role: AppleSurfaceRole.sidebar,
                child: _buildProfileRail(showEmptyActions: false),
              ),
            ),
            SizedBox(width: tokens.columnGap),
            Expanded(
              child: AppleMaterialSurface(
                role: AppleSurfaceRole.content,
                child: _buildChatStage(
                  layout: ProductShellLayout.standard,
                  onSelectMessage: onShowMessageInspector,
                  showDetailsAction: true,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCompactLayout(BuildContext context) {
    return _buildChatStage(
      layout: ProductShellLayout.compact,
      onSelectMessage: onShowMessageInspector,
      showDetailsAction: false,
    );
  }

  Widget _buildProfileRail({required bool showEmptyActions}) {
    return ProfileRail(
      profiles: controller.profiles,
      activeProfileId: controller.activeProfileId,
      surfaceNotice: controller.surfaceNotice,
      onCreateProfile: onEditProfile,
      onImportProfile: onImportProfile,
      showEmptyActions: showEmptyActions,
      onActivateProfile: controller.activateProfile,
      onEditProfile: (profile) => onEditProfile(initialProfile: profile),
      onDeleteProfile: onDeleteProfile,
    );
  }

  Widget _buildChatStage({
    required ProductShellLayout layout,
    required ValueChanged<ChatMessage> onSelectMessage,
    required bool showDetailsAction,
  }) {
    return ChatStagePanel(
      activeProfile: controller.activeProfile,
      chatController: controller.chatController,
      layout: layout,
      selectedMessageViewKey: controller.selectedMessage?.viewKey,
      onSelectMessage: onSelectMessage,
      onCreateProfile: onEditProfile,
      onImportProfile: onImportProfile,
      onEditProfile: () =>
          onEditProfile(initialProfile: controller.activeProfile),
      onReconnect: controller.reconnectActiveProfile,
      onDisconnect: controller.disconnectActiveProfile,
      onShowDetails: onShowRoomInspector,
      showDetailsAction: showDetailsAction,
    );
  }

  Widget _buildDetailRail() {
    return DetailRail(
      activeProfile: controller.activeProfile,
      chatController: controller.chatController,
      selectedMessage: controller.selectedMessage,
      onCopyShareLink: onCopyShareLink,
      onClearSelectedMessage: () => controller.selectMessage(null),
    );
  }
}
