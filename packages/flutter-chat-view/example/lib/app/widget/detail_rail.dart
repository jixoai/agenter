import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import 'ios26_surfaces.dart';
import 'ios26_theme_extension.dart';

class DetailRail extends StatelessWidget {
  const DetailRail({
    super.key,
    required this.activeProfile,
    required this.chatController,
    required this.selectedMessage,
    required this.onCopyShareLink,
    required this.onClearSelectedMessage,
  });

  final ConnectionProfile? activeProfile;
  final ChatViewController? chatController;
  final ChatMessage? selectedMessage;
  final VoidCallback onCopyShareLink;
  final VoidCallback onClearSelectedMessage;

  @override
  Widget build(BuildContext context) {
    final activeProfile = this.activeProfile;
    if (activeProfile == null) {
      return const _EmptyDetailRail();
    }
    final chatController = this.chatController;
    if (chatController == null) {
      return _ProfileOverview(
        profile: activeProfile,
        onCopyShareLink: onCopyShareLink,
      );
    }
    return AnimatedBuilder(
      animation: chatController,
      builder: (context, child) {
        final state = chatController.state;
        return Ios26Scrollbar(
          builder: (context, scrollController) => ListView(
            controller: scrollController,
            padding: EdgeInsets.zero,
            children: [
              _RoomSection(
                profile: activeProfile,
                state: state,
                onCopyShareLink: onCopyShareLink,
              ),
              _DetailSectionLabel(
                title: ProductShellLocalizations.of(
                  context,
                ).participantsSectionTitle,
              ),
              _ParticipantsSection(
                participants:
                    state.channel?.participants ?? const <ChatParticipant>[],
              ),
              _DetailSectionLabel(
                title: ProductShellLocalizations.of(
                  context,
                ).selectedMessageSectionTitle,
              ),
              if (selectedMessage case final message?)
                _SelectedMessageSection(
                  message: message,
                  onClearSelection: onClearSelectedMessage,
                )
              else
                const _NoSelectedMessageSection(),
            ],
          ),
        );
      },
    );
  }
}

class _EmptyDetailRail extends StatelessWidget {
  const _EmptyDetailRail();

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Ios26Scrollbar(
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: EdgeInsets.zero,
        children: [
          CupertinoListSection.insetGrouped(
            margin: EdgeInsets.zero,
            backgroundColor: CupertinoColors.transparent,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.roomDetailEmpty,
                      style: context.iosCaptionTextStyle.copyWith(
                        color: CupertinoDynamicColor.resolve(
                          CupertinoColors.label,
                          context,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      l10n.roomDetailPassiveHint,
                      style: context.iosFootnoteTextStyle,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProfileOverview extends StatelessWidget {
  const _ProfileOverview({
    required this.profile,
    required this.onCopyShareLink,
  });

  final ConnectionProfile profile;
  final VoidCallback onCopyShareLink;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return Ios26Scrollbar(
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: EdgeInsets.zero,
        children: [
          CupertinoListSection.insetGrouped(
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
                title: Text(l10n.copyShareLink),
                trailing: const Icon(CupertinoIcons.doc_on_clipboard),
                onTap: onCopyShareLink,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RoomSection extends StatelessWidget {
  const _RoomSection({
    required this.profile,
    required this.state,
    required this.onCopyShareLink,
  });

  final ConnectionProfile profile;
  final ChatViewState state;
  final VoidCallback onCopyShareLink;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    final roomTitle = state.channel?.displayTitle ?? profile.displayName;
    final roomSubtitle = state.channel?.chatId ?? profile.hostLabel;
    return CupertinoListSection.insetGrouped(
      margin: EdgeInsets.zero,
      backgroundColor: CupertinoColors.transparent,
      children: [
        CupertinoListTile.notched(
          title: Text(roomTitle, style: context.iosEmphasisTextStyle),
          subtitle: Text(roomSubtitle),
        ),
        CupertinoListTile.notched(
          title: Text(l10n.connectionSectionTitle),
          subtitle: Text(
            l10n.connectionSummary(
              l10n.connectionLabel(state.connectionState.name),
              state.focused ? l10n.focused : l10n.background,
            ),
          ),
          additionalInfo: Text(
            profile.accessToken == null ? l10n.noUploadToken : l10n.uploadReady,
            style: context.iosFootnoteTextStyle,
          ),
        ),
        CupertinoListTile.notched(
          title: Text(l10n.copyShareLink),
          trailing: const Icon(CupertinoIcons.doc_on_clipboard),
          onTap: onCopyShareLink,
        ),
      ],
    );
  }
}

class _ParticipantsSection extends StatelessWidget {
  const _ParticipantsSection({required this.participants});

  final List<ChatParticipant> participants;

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return CupertinoListSection.insetGrouped(
      margin: EdgeInsets.zero,
      backgroundColor: CupertinoColors.transparent,
      children: participants.isEmpty
          ? <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                child: Text(
                  l10n.participantsEmptyBody,
                  style: context.iosCaptionTextStyle,
                ),
              ),
            ]
          : participants
                .map(
                  (participant) => CupertinoListTile.notched(
                    title: Text(participant.label ?? participant.id),
                    subtitle: participant.label == null
                        ? null
                        : Text(participant.id),
                  ),
                )
                .toList(growable: false),
    );
  }
}

class _NoSelectedMessageSection extends StatelessWidget {
  const _NoSelectedMessageSection();

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    return CupertinoListSection.insetGrouped(
      margin: EdgeInsets.zero,
      backgroundColor: CupertinoColors.transparent,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Text(
            l10n.selectedMessageEmptyBody,
            style: context.iosCaptionTextStyle,
          ),
        ),
      ],
    );
  }
}

class _SelectedMessageSection extends StatelessWidget {
  const _SelectedMessageSection({
    required this.message,
    required this.onClearSelection,
  });

  final ChatMessage message;
  final VoidCallback onClearSelection;

  @override
  Widget build(BuildContext context) {
    final chatL10n = ChatViewLocalizations.of(context);
    final l10n = ProductShellLocalizations.of(context);
    final metadata = <String>[
      l10n.rowLabel(message.rowId),
      if (message.messageId != null) l10n.messageLabel(message.messageId!),
      message.kind.name,
      if (message.isEdited) chatL10n.edited,
      if (message.isRecalled) chatL10n.recalled,
    ];
    return CupertinoListSection.insetGrouped(
      margin: EdgeInsets.zero,
      backgroundColor: CupertinoColors.transparent,
      children: [
        CupertinoListTile.notched(
          title: Text(message.from),
          subtitle: Text(l10n.createdAtLabel(context, message.createdAt)),
          trailing: CupertinoButton(
            padding: EdgeInsets.zero,
            minimumSize: const Size(44, 44),
            alignment: Alignment.center,
            onPressed: onClearSelection,
            child: Text(l10n.clear),
          ),
        ),
        _SelectableDetailBlock(
          text: message.isRecalled
              ? chatL10n.recalledMessageText
              : message.displayText,
        ),
        CupertinoListTile.notched(
          title: Text(l10n.messageFactsLabel),
          subtitle: Text(metadata.join(' · ')),
        ),
        CupertinoListTile.notched(
          title: Text(l10n.readByLabel(message.readActorIds)),
        ),
        CupertinoListTile.notched(
          title: Text(l10n.unreadByLabel(message.unreadActorIds)),
        ),
        if (message.attachments.isNotEmpty)
          ...message.attachments.map(
            (attachment) => CupertinoListTile.notched(
              title: Text(attachment.name),
              subtitle: Text(
                l10n.attachmentMeta(
                  attachment.kind.name,
                  attachment.mimeType,
                  attachment.sizeBytes,
                ),
              ),
              trailing: const Icon(CupertinoIcons.doc_on_clipboard),
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: attachment.url));
                if (!context.mounted) {
                  return;
                }
                await showIos26Toast(context, l10n.copyAssetUrlFeedback);
              },
            ),
          ),
      ],
    );
  }
}

class _DetailSectionLabel extends StatelessWidget {
  const _DetailSectionLabel({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 6, 20, 6),
      child: Text(
        title,
        style: context.iosFootnoteTextStyle.copyWith(
          fontWeight: FontWeight.w600,
          color: CupertinoDynamicColor.resolve(
            CupertinoColors.secondaryLabel,
            context,
          ),
        ),
      ),
    );
  }
}

class _SelectableDetailBlock extends StatelessWidget {
  const _SelectableDetailBlock({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
      child: SelectableRegion(
        selectionControls: cupertinoTextSelectionHandleControls,
        child: Text(
          text,
          style: context.iosCaptionTextStyle.copyWith(
            color: CupertinoDynamicColor.resolve(
              CupertinoColors.label,
              context,
            ),
          ),
        ),
      ),
    );
  }
}
