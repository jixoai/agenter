# agenter

`agenter` is distributed as a host-native Bun-compiled CLI.

## Install

### npm

```bash
npm install -g agenter
```

The public `agenter` package is a thin wrapper. Normal installs resolve one host-native `@jixoai/cli-*` platform package and run that compiled executable directly.

### Homebrew

```bash
brew tap jixoai/agenter
brew install agenter
```

The Homebrew formula installs the same canonical release archive used by npm projections. It does not bootstrap Bun as a separate runtime dependency.

## Supported targets

Phase-1 native CLI support:

- `darwin-arm64`
- `darwin-x64`
- `linux-arm64-gnu`
- `linux-arm64-musl`
- `linux-x64-gnu`
- `linux-x64-musl`
- `win32-arm64`
- `win32-x64`

## Binary truth

GitHub release archives are the canonical binary truth for Agenter.

- `agenter` on npm is a wrapper projection over those archives
- `@jixoai/cli-*` packages are thin per-target binary atoms
- the Homebrew tap is a generated projection from the same release manifest

Canonical archive naming:

- macOS and Linux: `agenter-<target>.tar.gz`
- Windows: `agenter-<target>.zip`

Each release also ships:

- per-target `sha256` files
- `agenter-release-archives.json`, the machine-readable manifest that maps targets to archive files, checksums, URLs, npm package names, and Homebrew selectors

## Development

Useful release commands:

```bash
bun run release:prepare-native-cli-packages
bun run release:prepare-packages
bun run release:publish-bundles --dry-run
```
