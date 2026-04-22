import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter_chat_view/flutter_chat_view.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../controller/product_shell_controller.dart';
import '../l10n/product_shell_localizations.dart';
import '../store/connection_profile_store.dart';
import 'ios26_theme.dart';
import 'product_shell_page.dart';

class ProductShellApp extends StatefulWidget {
  const ProductShellApp({
    super.key,
    this.store,
    this.bootstrapUri,
    this.connectOnActivate = true,
  });

  final ConnectionProfileStore? store;
  final Uri? bootstrapUri;
  final bool connectOnActivate;

  @override
  State<ProductShellApp> createState() => _ProductShellAppState();
}

class _ProductShellAppState extends State<ProductShellApp> {
  late final ProductShellController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ProductShellController(
      store: widget.store ?? SharedPreferencesConnectionProfileStore(),
      connectOnActivate: widget.connectOnActivate,
    );
    unawaited(_controller.initialize(widget.bootstrapUri ?? Uri.base));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoApp(
      onGenerateTitle: (context) =>
          ProductShellLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: buildIos26Theme(),
      localizationsDelegates: const <LocalizationsDelegate<dynamic>>[
        ProductShellLocalizations.delegate,
        ChatViewLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const <Locale>[
        Locale('en'),
        Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hans'),
      ],
      home: ProductShellPage(controller: _controller),
    );
  }
}
