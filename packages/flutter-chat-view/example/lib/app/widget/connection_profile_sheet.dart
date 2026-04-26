import 'package:flutter/cupertino.dart';

import '../l10n/product_shell_localizations.dart';
import '../model/connection_profile.dart';
import 'apple_platform_theme.dart';

Future<ConnectionProfileDraft?> showConnectionProfileSheet(
  BuildContext context, {
  ConnectionProfile? initialProfile,
}) {
  return showCupertinoModalPopup<ConnectionProfileDraft>(
    context: context,
    barrierColor: const Color(0x33000000),
    builder: (context) =>
        ConnectionProfileSheet(initialProfile: initialProfile),
  );
}

Future<ConnectionProfileDraft?> showImportConnectionProfileSheet(
  BuildContext context,
) {
  return showCupertinoModalPopup<ConnectionProfileDraft>(
    context: context,
    barrierColor: const Color(0x33000000),
    builder: (context) => const ConnectionProfileSheet(importMode: true),
  );
}

class ConnectionProfileSheet extends StatefulWidget {
  const ConnectionProfileSheet({
    super.key,
    this.initialProfile,
    this.importMode = false,
  });

  final ConnectionProfile? initialProfile;
  final bool importMode;

  @override
  State<ConnectionProfileSheet> createState() => _ConnectionProfileSheetState();
}

class _ConnectionProfileSheetState extends State<ConnectionProfileSheet> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _urlController;
  late final TextEditingController _tokenController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.initialProfile?.name ?? '',
    );
    _urlController = TextEditingController(
      text: widget.initialProfile?.transportUrl ?? '',
    );
    _tokenController = TextEditingController(
      text: widget.initialProfile?.accessToken ?? '',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _urlController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    Navigator.of(context).pop(
      ConnectionProfileDraft(
        name: widget.importMode ? '' : _nameController.text.trim(),
        transportUrl: _urlController.text.trim(),
        accessToken: _tokenController.text.trim(),
      ),
    );
  }

  String? _validateTransportUrl(ProductShellLocalizations l10n, String? value) {
    final trimmed = value?.trim() ?? '';
    if (trimmed.isEmpty) {
      return l10n.transportUrlRequired;
    }
    final parsed = Uri.tryParse(trimmed);
    if (parsed == null || !parsed.hasScheme || parsed.host.isEmpty) {
      return l10n.transportUrlInvalid;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ProductShellLocalizations.of(context);
    final isEditing = widget.initialProfile != null;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          12,
          12,
          12,
          MediaQuery.of(context).viewInsets.bottom + 16,
        ),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: CupertinoPopupSurface(
            child: Form(
              key: _formKey,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 42,
                        height: 5,
                        decoration: BoxDecoration(
                          color: resolveAppleColor(
                            context,
                            CupertinoColors.systemGrey3,
                          ),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        widget.importMode
                            ? l10n.importUrlAndToken
                            : isEditing
                            ? l10n.roomProfileDialogTitle
                            : l10n.newProfileDialogTitle,
                        style: context.appleTitleTextStyle,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        widget.importMode
                            ? l10n.importDialogBody
                            : l10n.profileDialogBody,
                        style: context.appleCaptionTextStyle,
                      ),
                    ),
                    const SizedBox(height: 14),
                    CupertinoFormSection.insetGrouped(
                      margin: EdgeInsets.zero,
                      backgroundColor: CupertinoColors.transparent,
                      children: [
                        if (!widget.importMode)
                          CupertinoTextFormFieldRow(
                            controller: _nameController,
                            prefix: Text(l10n.profileNameLabel),
                            placeholder: l10n.profileNameHint,
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return l10n.profileNameRequired;
                              }
                              return null;
                            },
                          ),
                        CupertinoTextFormFieldRow(
                          controller: _urlController,
                          prefix: Text(l10n.transportUrlLabel),
                          placeholder: 'ws://127.0.0.1:4600/room/<chatId>',
                          keyboardType: TextInputType.url,
                          autofocus: widget.importMode,
                          validator: (value) =>
                              _validateTransportUrl(l10n, value),
                        ),
                        CupertinoTextFormFieldRow(
                          controller: _tokenController,
                          prefix: Text(l10n.accessTokenLabel),
                          placeholder: 'msgtok_...',
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 6),
                      child: Row(
                        children: [
                          Expanded(
                            child: CupertinoButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: Text(l10n.cancel),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: CupertinoButton.filled(
                              onPressed: _submit,
                              child: Text(
                                widget.importMode
                                    ? l10n.importUrlAndToken
                                    : isEditing
                                    ? l10n.saveProfile
                                    : l10n.createProfileAction,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
