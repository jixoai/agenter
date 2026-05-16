## Why

Double-click and triple-click selection are now accepted, but the same interaction law has to cover keyboard navigation. When the user types, presses arrows, Home, End, or word-navigation keys after scrolling away, cli-shell must return to the backend cursor instead of leaving the screen at stale scrollback.

The broader issue is that some terminal engines already implement rich selection/navigation behavior while others do not. cli-shell needs a configurable offscreen interaction enhancement layer that can fill only the missing behavior without overriding capable backends.

## What Changes

- Add configurable offscreen terminal interaction enhancements for semantic word selection, row selection, word navigation, cursor-follow input, and Home/End fallback.
- Add backend capability recommendation coverage so cli-shell can enable only the enhancements missing from each backend.
- Extend shell keyboard navigation so printable input, arrows, Home, End, and supported navigation keys request backend cursor follow after successful shell input.
- Add Option+Left/Right word navigation using the same ICU word segmentation and terminal cell-width mapping as double-click word selection.
- Keep Option+Up/Down as backend-native passthrough; cli-shell will not invent product semantics for those keys.
- Add BDD coverage for the supported terminal key matrix and interaction enhancement decisions.

## Capabilities

### New Capabilities

- `cli-shell-interaction-capabilities`: Configurable backend capability recommendations and offscreen interaction enhancement policy for cli-shell.

### Modified Capabilities

- `terminal-screen-projection-law`: Offscreen shell input and semantic interaction requirements now include configurable enhancements, word navigation, Home/End fallback, and cursor-follow coverage for navigation keys.

## Impact

- Affected package: `@agenter/cli-shell`.
- Affected modules: TUI input encoding, backend frame projection selection logic, live mirror cursor-follow routing, CLI/web startup configuration propagation if needed.
- Affected tests: cli-shell TUI BDD tests, live terminal mirror tests, package boundary tests, and a backend capability recommendation test.
- No core terminal-system dependency may be added for cli-shell-specific product behavior.
