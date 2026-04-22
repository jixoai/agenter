import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/semantics.dart';

import 'app/widget/product_shell_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  if (kIsWeb) {
    SemanticsBinding.instance.ensureSemantics();
  }
  runApp(const ProductShellApp());
}
