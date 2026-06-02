# agenter

## 0.0.8

### Patch Changes

- Release the ShellAssistant prompt composition updates and the GitHub trusted publishing release path.

## 0.0.7

### Patch Changes

- Promote the Agenter app platform vocabulary, publish first-party apps from apps/\*, and preserve app-owned host compatibility through peerDependencies.agenter.

## 0.0.6

### Patch Changes

- 70d1e89: Promote Shell as the stable `agenter shell` app and remove the old `shell2` incubation command.

## 0.0.1

### Patch Changes

- 43dd511: Prepare the external cli-shell app for npm installation and runtime use:
  - add the public `agenter` wrapper package that resolves external app commands without importing core app code
  - make `agenter shell --help` and `agenter-cli-shell --help` metadata-only paths zero-side-effect
  - bundle terminal and prompt/i18n runtime assets so installed tarballs can start the daemon and cli-shell without missing module or prompt file errors
  - keep cli-shell TUI loading lazy so non-TTY and help flows do not resolve OpenTUI platform code early
  - publish Studio and Shell as unscoped community extension packages, and publish the Agenter-owned Ghostty native backend under the Jixo organization scope
