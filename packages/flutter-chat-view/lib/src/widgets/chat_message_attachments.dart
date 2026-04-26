import 'package:flutter/cupertino.dart';

import '../model/chat_models.dart';
import 'chat_surface_theme.dart';

class ChatAttachmentStrip extends StatelessWidget {
  const ChatAttachmentStrip({super.key, required this.attachments});

  final List<ChatAttachment> attachments;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: chatTokens(context).blockGap),
      child: Wrap(
        spacing: chatTokens(context).inlineGap,
        runSpacing: chatTokens(context).inlineGap,
        children: attachments
            .map(
              (attachment) => attachment.kind == ChatAttachmentKind.image
                  ? ChatImageAttachmentCard(attachment: attachment)
                  : ChatFileAttachmentPill(attachment: attachment),
            )
            .toList(growable: false),
      ),
    );
  }
}

class ChatImageAttachmentCard extends StatelessWidget {
  const ChatImageAttachmentCard({super.key, required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 152,
      decoration: buildChatPanelDecoration(
        context,
        radius: chatTokens(context).blockRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.vertical(
              top: Radius.circular(chatTokens(context).blockRadius),
            ),
            child: SizedBox(
              height: 104,
              width: double.infinity,
              child: Image.network(
                attachment.url,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => ColoredBox(
                  color: resolveChatColor(
                    context,
                    CupertinoColors.tertiarySystemGroupedBackground,
                  ),
                  child: const Center(
                    child: Icon(CupertinoIcons.photo_fill_on_rectangle_fill),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: chatTokens(context).blockPadding,
            child: Text(
              attachment.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: chatTextStyle(context, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class ChatFileAttachmentPill extends StatelessWidget {
  const ChatFileAttachmentPill({super.key, required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final icon = switch (attachment.kind) {
      ChatAttachmentKind.image => CupertinoIcons.photo,
      ChatAttachmentKind.video => CupertinoIcons.video_camera,
      ChatAttachmentKind.file => CupertinoIcons.doc,
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(chatTokens(context).controlRadius),
      ),
      child: Padding(
        padding: chatTokens(context).pillPadding,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14),
            SizedBox(width: chatTokens(context).inlineGap),
            Text(
              attachment.name,
              style: chatSecondaryTextStyle(
                context,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
