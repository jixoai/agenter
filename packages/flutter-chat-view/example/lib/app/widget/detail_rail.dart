import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';

import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import 'apple_surfaces.dart';
import 'apple_platform_theme.dart';
import 'apple_sections.dart';

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
        return AppleScrollbar(
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
    return AppleScrollbar(
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: EdgeInsets.zero,
        children: [
          AppleSection(
            children: [
              AppleSectionBody(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.roomDetailEmpty,
                      style: context.appleCaptionTextStyle.copyWith(
                        color: CupertinoDynamicColor.resolve(
                          CupertinoColors.label,
                          context,
                        ),
                      ),
                    ),
                    SizedBox(height: appleTokens(context).controlGap),
                    Text(
                      l10n.roomDetailPassiveHint,
                      style: context.appleFootnoteTextStyle,
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
    return AppleScrollbar(
      builder: (context, scrollController) => ListView(
        controller: scrollController,
        padding: EdgeInsets.zero,
        children: [
          AppleSection(
            children: [
              CupertinoListTile.notched(
                title: Text(
                  profile.displayName,
                  style: context.appleEmphasisTextStyle,
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
    return AppleSection(
      children: [
        CupertinoListTile.notched(
          title: Text(roomTitle, style: context.appleEmphasisTextStyle),
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
            style: context.appleFootnoteTextStyle,
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
    return AppleSection(
      children: participants.isEmpty
          ? <Widget>[
              AppleSectionBody(
                child: Text(
                  l10n.participantsEmptyBody,
                  style: context.appleCaptionTextStyle,
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
    return AppleSection(
      children: [
        AppleSectionBody(
          child: Text(
            l10n.selectedMessageEmptyBody,
            style: context.appleCaptionTextStyle,
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
    return AppleSection(
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
        _SelectedMessageTextBlock(
          text: message.isRecalled
              ? chatL10n.recalledMessageText
              : message.displayText,
        ),
        CupertinoListTile.notched(
          title: Text(chatL10n.copyText),
          trailing: const Icon(CupertinoIcons.doc_on_clipboard),
          onTap: () async {
            final text = message.isRecalled
                ? chatL10n.recalledMessageText
                : message.displayText;
            await Clipboard.setData(ClipboardData(text: text));
            if (!context.mounted) {
              return;
            }
            await showAppleToast(context, l10n.selectedMessageCopied);
          },
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
                await showAppleToast(context, l10n.copyAssetUrlFeedback);
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
  Widget build(BuildContext context) => AppleSectionLabel(title: title);
}

class _SelectedMessageTextBlock extends StatelessWidget {
  const _SelectedMessageTextBlock({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return AppleSectionBody(
      padding: appleTokens(context).sectionActionPadding,
      child: Text(
        text,
        style: context.appleCaptionTextStyle.copyWith(
          color: CupertinoDynamicColor.resolve(CupertinoColors.label, context),
        ),
      ),
    );
  }
}
