---
"agenter": patch
"@agenter/cli-shell": patch
"@agenter/i18n-en": patch
"@agenter/i18n-zh-hans": patch
---

Prepare the external cli-shell product for npm installation and runtime use:

- add the public `agenter` wrapper package that resolves external product commands without importing core product code
- make `agenter shell --help` and `agenter-cli-shell --help` metadata-only paths zero-side-effect
- bundle terminal and prompt/i18n runtime assets so installed tarballs can start the daemon and cli-shell without missing module or prompt file errors
- keep cli-shell TUI loading lazy so non-TTY and help flows do not resolve OpenTUI platform code early
