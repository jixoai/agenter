enum ProductShellNoticeKind {
  importedSharedRoomLink,
  loadedSharedRoomLink,
  profileSaved,
  profileUpdated,
  profileRemoved,
  transportDisconnected,
  transportConnecting,
  transportConnected,
}

class ProductShellNotice {
  const ProductShellNotice(this.kind, {this.profileName});

  final ProductShellNoticeKind kind;
  final String? profileName;
}
