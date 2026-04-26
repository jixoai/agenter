import 'package:flutter/cupertino.dart';

import '../controller/product_shell_controller.dart';
import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import 'compact_route_sheet.dart';
import 'detail_rail.dart';
import 'profile_rail.dart';

typedef ProductShellCopyShareLink = Future<void> Function(BuildContext context);
typedef ProductShellDeleteProfile =
    Future<void> Function(BuildContext context, String profileId);

Future<void> showProductShellProfileDirectorySheet(
  BuildContext context, {
  required ProductShellController controller,
  required VoidCallback onCreateProfile,
  required VoidCallback onImportProfile,
  required ValueChanged<ConnectionProfile> onEditProfile,
  required ProductShellDeleteProfile onDeleteProfile,
}) async {
  final l10n = ProductShellLocalizations.of(context);
  await _showProductShellRouteSheet(
    context,
    title: l10n.profilesTab,
    detent: CompactRouteSheetDetent.page,
    childBuilder: (sheetContext) => ProfileRail(
      profiles: controller.profiles,
      activeProfileId: controller.activeProfileId,
      surfaceNotice: controller.surfaceNotice,
      onCreateProfile: () {
        Navigator.of(sheetContext).pop();
        onCreateProfile();
      },
      onImportProfile: () {
        Navigator.of(sheetContext).pop();
        onImportProfile();
      },
      onActivateProfile: (profileId) async {
        await controller.activateProfile(profileId);
        if (sheetContext.mounted) {
          Navigator.of(sheetContext).pop();
        }
      },
      onEditProfile: (profile) {
        Navigator.of(sheetContext).pop();
        onEditProfile(profile);
      },
      onDeleteProfile: (profileId) => onDeleteProfile(sheetContext, profileId),
    ),
  );
}

Future<void> showProductShellRoomInspectorSheet(
  BuildContext context, {
  required ProductShellController controller,
  required ProductShellCopyShareLink onCopyShareLink,
}) async {
  final l10n = ProductShellLocalizations.of(context);
  await _showProductShellRouteSheet(
    context,
    title: l10n.detailsTab,
    detent: CompactRouteSheetDetent.inspector,
    childBuilder: (sheetContext) => DetailRail(
      activeProfile: controller.activeProfile,
      chatController: controller.chatController,
      selectedMessage: controller.selectedMessage,
      onCopyShareLink: () => onCopyShareLink(sheetContext),
      onClearSelectedMessage: () => controller.selectMessage(null),
    ),
  );
}

Future<void> showProductShellMessageInspectorSheet(
  BuildContext context, {
  required ProductShellController controller,
  required ProductShellCopyShareLink onCopyShareLink,
}) async {
  final l10n = ProductShellLocalizations.of(context);
  await _showProductShellRouteSheet(
    context,
    title: l10n.selectedMessageSectionTitle,
    detent: CompactRouteSheetDetent.inspector,
    childBuilder: (sheetContext) => DetailRail(
      activeProfile: controller.activeProfile,
      chatController: controller.chatController,
      selectedMessage: controller.selectedMessage,
      onCopyShareLink: () => onCopyShareLink(sheetContext),
      onClearSelectedMessage: () => controller.selectMessage(null),
    ),
  );
}

Future<void> _showProductShellRouteSheet(
  BuildContext context, {
  required String title,
  required CompactRouteSheetDetent detent,
  required WidgetBuilder childBuilder,
}) async {
  await showCupertinoModalPopup<void>(
    context: context,
    builder: (sheetContext) => CompactRouteSheet(
      title: title,
      detent: detent,
      onClose: () => Navigator.of(sheetContext).pop(),
      child: childBuilder(sheetContext),
    ),
  );
}
