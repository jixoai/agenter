enum ProductShellLayout { compact, standard, expanded }

ProductShellLayout resolveProductShellLayout(double width) {
  if (width < 720) {
    return ProductShellLayout.compact;
  }
  if (width < 1100) {
    return ProductShellLayout.standard;
  }
  return ProductShellLayout.expanded;
}

extension ProductShellLayoutX on ProductShellLayout {
  bool get isCompact => this == ProductShellLayout.compact;
  bool get showsStackedDetails => this == ProductShellLayout.standard;
  bool get showsInlineDetails => this == ProductShellLayout.expanded;
}
