# agenter-app-shell

## 0.0.1

### Patch Changes

- 43dd511: Prepare the external cli-shell app for npm installation and runtime use:
  - add the public `agenter` wrapper package that resolves external app commands without importing core app code
  - make `agenter shell --help` and `agenter-cli-shell --help` metadata-only paths zero-side-effect
  - bundle terminal and prompt/i18n runtime assets so installed tarballs can start the daemon and cli-shell without missing module or prompt file errors
  - keep cli-shell TUI loading lazy so non-TTY and help flows do not resolve OpenTUI platform code early
  - publish Studio and Shell as unscoped community extension packages, and publish the Agenter-owned Ghostty native backend under the Jixo organization scope
  - @agenter/termless-core@0.0.1
  - @agenter/client-sdk@0.0.1
