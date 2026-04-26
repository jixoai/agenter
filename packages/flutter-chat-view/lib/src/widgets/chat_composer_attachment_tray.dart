import 'package:cross_file/cross_file.dart';
import 'package:flutter/cupertino.dart';

import 'chat_surface_theme.dart';

class ChatPendingAttachmentTray extends StatelessWidget {
  const ChatPendingAttachmentTray({
    super.key,
    required this.files,
    required this.onDelete,
  });

  final List<XFile> files;
  final ValueChanged<XFile> onDelete;

  @override
  Widget build(BuildContext context) {
    if (files.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: EdgeInsets.only(bottom: chatTokens(context).inlineGap),
      child: Wrap(
        spacing: chatTokens(context).inlineGap,
        runSpacing: chatTokens(context).inlineGap,
        children: files
            .map(
              (file) => ChatPendingFilePill(
                file: file,
                onDelete: () => onDelete(file),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

class ChatPendingFilePill extends StatelessWidget {
  const ChatPendingFilePill({
    super.key,
    required this.file,
    required this.onDelete,
  });

  final XFile file;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: resolveChatColor(
          context,
          CupertinoColors.tertiarySystemGroupedBackground,
        ),
        borderRadius: BorderRadius.circular(chatTokens(context).controlRadius),
      ),
      child: Padding(
        padding: chatTokens(context).pillPadding.copyWith(right: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              CupertinoIcons.doc,
              size: 14,
              color: resolveChatColor(context, CupertinoColors.secondaryLabel),
            ),
            SizedBox(width: chatTokens(context).inlineGap),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 180),
              child: Text(
                file.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: chatSecondaryTextStyle(
                  context,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            CupertinoButton(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              minimumSize: Size.zero,
              onPressed: onDelete,
              child: const Icon(CupertinoIcons.clear_circled_solid, size: 18),
            ),
          ],
        ),
      ),
    );
  }
}
