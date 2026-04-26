import 'package:flutter/cupertino.dart';

import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import '../model/product_shell_notice.dart';
import 'apple_icon_button.dart';
import 'apple_surfaces.dart';
import 'apple_platform_theme.dart';
import 'apple_sections.dart';

class ProfileRail extends StatelessWidget {
  const ProfileRail({
    super.key,
    required this.profiles,
    required this.activeProfileId,
    required this.onCreateProfile,
    required this.onImportProfile,
    this.showEmptyActions = true,
    required this.onActivateProfile,
    required this.onEditProfile,
    required this.onDeleteProfile,
    this.surfaceNotice,
  });

  final List<ConnectionProfile> profiles;
  final String? activeProfileId;
  final VoidCallback onCreateProfile;
  final VoidCallback onImportProfile;
  final bool showEmptyActions;
  final ValueChanged<String> onActivateProfile;
  final ValueChanged<ConnectionProfile> onEditProfile;
  final ValueChanged<String> onDeleteProfile;
  final ProductShellNotice? surfaceNotice;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Column(
      children: [
        AppleSection(
          children: [
            CupertinoListTile.notched(
              title: Text(
                l10n.profilesTitle,
                style: context.appleEmphasisTextStyle,
              ),
              subtitle: Text(l10n.profilesSubtitle),
            ),
            if (surfaceNotice case final notice?)
              CupertinoListTile.notched(
                title: Text(
                  l10n.notice(notice),
                  style: context.appleCaptionTextStyle.copyWith(
                    color: resolveAppleColor(context, CupertinoColors.label),
                  ),
                ),
                leading: Icon(
                  CupertinoIcons.check_mark_circled,
                  color: CupertinoTheme.of(context).primaryColor,
                  size: 18,
                ),
              ),
          ],
        ),
        const ApplePanelGap(),
        Expanded(
          child: profiles.isEmpty
              ? _EmptyProfiles(
                  onCreateProfile: onCreateProfile,
                  onImportProfile: onImportProfile,
                  showActions: showEmptyActions,
                )
              : AppleScrollbar(
                  builder: (context, scrollController) => ListView(
                    controller: scrollController,
                    padding: EdgeInsets.zero,
                    children: [
                      AppleSection(
                        children: profiles
                            .map(
                              (profile) => _ProfileTile(
                                profile: profile,
                                active: profile.id == activeProfileId,
                                onActivate: () => onActivateProfile(profile.id),
                                onEdit: () => onEditProfile(profile),
                                onDelete: () => onDeleteProfile(profile.id),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

class _EmptyProfiles extends StatelessWidget {
  const _EmptyProfiles({
    required this.onCreateProfile,
    required this.onImportProfile,
    required this.showActions,
  });

  final VoidCallback onCreateProfile;
  final VoidCallback onImportProfile;
  final bool showActions;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: AppleSection(
          children: [
            AppleSectionBody(
              padding: showActions
                  ? appleTokens(context).emptyStatePadding
                  : appleTokens(context).sectionBodyPadding,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    CupertinoIcons.square_grid_2x2,
                    size: showActions ? 34 : 28,
                    color: CupertinoTheme.of(context).primaryColor,
                  ),
                  SizedBox(height: appleTokens(context).controlGap),
                  Text(
                    l10n.emptyProfilesTitle,
                    textAlign: TextAlign.center,
                    style: context.appleEmphasisTextStyle,
                  ),
                  SizedBox(height: appleTokens(context).controlGap),
                  Text(
                    showActions
                        ? l10n.emptyProfilesBody
                        : l10n.profilesEmptyFollowStageHint,
                    textAlign: TextAlign.center,
                    style: showActions
                        ? context.appleCaptionTextStyle
                        : context.appleFootnoteTextStyle,
                  ),
                  if (showActions) ...[
                    SizedBox(height: appleTokens(context).sectionGap),
                    AppleActionGroup(
                      children: [
                        CupertinoButton.filled(
                          onPressed: onCreateProfile,
                          child: Text(l10n.newProfile),
                        ),
                        CupertinoButton(
                          onPressed: onImportProfile,
                          child: Text(l10n.importUrlAndToken),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.profile,
    required this.active,
    required this.onActivate,
    required this.onEdit,
    required this.onDelete,
  });

  final ConnectionProfile profile;
  final bool active;
  final VoidCallback onActivate;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  Future<void> _showActions(BuildContext context) async {
    final l10n = ProductShellLocalizations.of(context);
    await showCupertinoModalPopup<void>(
      context: context,
      builder: (sheetContext) => CupertinoActionSheet(
        title: Text(profile.displayName),
        actions: [
          CupertinoActionSheetAction(
            onPressed: () {
              Navigator.of(sheetContext).pop();
              onEdit();
            },
            child: Text(l10n.edit),
          ),
          CupertinoActionSheetAction(
            isDestructiveAction: true,
            onPressed: () {
              Navigator.of(sheetContext).pop();
              onDelete();
            },
            child: Text(l10n.delete),
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
    final primary = CupertinoTheme.of(context).primaryColor;
    return CupertinoListTile.notched(
      backgroundColor: active
          ? primary.withValues(alpha: 0.08)
          : resolveAppleColor(
              context,
              CupertinoColors.secondarySystemGroupedBackground,
            ),
      title: Text(profile.displayName, style: context.appleEmphasisTextStyle),
      subtitle: Text(profile.hostLabel, style: context.appleCaptionTextStyle),
      additionalInfo: active
          ? Text(
              l10n.activeProfilePill,
              style: context.appleFootnoteTextStyle.copyWith(color: primary),
            )
          : null,
      trailing: AppleIconButton(
        icon: CupertinoIcons.ellipsis_circle,
        label: l10n.profileActions,
        onPressed: () => _showActions(context),
      ),
      onTap: onActivate,
    );
  }
}
