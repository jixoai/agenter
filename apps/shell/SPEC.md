# agenter-app-shell SPEC

## Purpose

`agenter-app-shell` is the official interactive Shell app for Agenter. It is launched by `agenter shell` through the app command descriptor and owns only app presentation, local OpenTUI/opencompose composition, and app lifecycle orchestration.

## Durable Contracts

- `agenter shell` resolves to `agenter-app-shell` / `agenter-shell` / `runShell`.
- `agenter shell2` is not a app command.
- Shell truth remains in TerminalSystem; Room truth remains in MessageSystem; AvatarRuntime and AttentionSystem remain core runtime owners.
- Shell binds TerminalSystem terminal instances and MessageSystem room instances through app metadata/resource keys; it does not hard-code terminal/room ownership into kernel systems.
- Shell uses opencompose/renderable mux as local presentation law. Pane ids, layout ids, and renderer ids are presentation facts, not durable terminal or room truth.
- App-attached terminals and local BunPTY terminals are separate source-policy capabilities. A app-bound session must not create a local BunPTY fallback when a app split is unavailable.
- Shell-assistant seed flow only seeds missing `AGENTER.mdx` prompt guidance. The default prompt teaches NoteSystem recording through the projected `note` CLI and the `note` skill; it must not create or list `user-model.md`, `pairing-playbook.md`, `terminal-habits.md`, `self-evolution-log.md`, or `hosting-objective.md` as the default recording pack.
- `apps/shell-old` is preserved legacy code. Shell must not import `agenter-app-shell-old` or `apps/shell-old` at runtime.
