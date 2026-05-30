# agenter-ext-shell SPEC

## Purpose

`agenter-ext-shell` is the official interactive Shell product for Agenter. It is launched by `agenter shell` through the product command descriptor and owns only product presentation, local OpenTUI/opencompose composition, and product lifecycle orchestration.

## Durable Contracts

- `agenter shell` resolves to `agenter-ext-shell` / `agenter-shell` / `runShell`.
- `agenter shell2` is not a product command.
- Shell truth remains in TerminalSystem; Room truth remains in MessageSystem; AvatarRuntime and AttentionSystem remain core runtime owners.
- Shell binds TerminalSystem terminal instances and MessageSystem room instances through product metadata/resource keys; it does not hard-code terminal/room ownership into kernel systems.
- Shell uses opencompose/renderable mux as local presentation law. Pane ids, layout ids, and renderer ids are presentation facts, not durable terminal or room truth.
- Product-attached terminals and local BunPTY terminals are separate source-policy capabilities. A product-bound session must not create a local BunPTY fallback when a product split is unavailable.
- `extensions/shell-old` is preserved legacy code. Shell must not import `agenter-ext-shell-old` or `extensions/shell-old` at runtime.
