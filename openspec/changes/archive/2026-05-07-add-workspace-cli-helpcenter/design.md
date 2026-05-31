## Context

The repository already has one strong law and one gap. The strong law is that runtime CLI commands are descriptor-backed: `message send --help`, `terminal create --help`, and similar flows already derive description, schema, and examples from one shared registry. The gap is that workspace-level command discovery still has no equivalent shared truth. `just-bash` builtins come from the shell, runtime CLI commands come from the descriptor registry, and workspace file-backed tools are only auto-bound into `tool_*` helpers at execution time.

The gap becomes visible in both shell and browser surfaces. A bare `help` invocation in `just-bash` lists only shell builtins and does not recognize `defineCommand(...)` custom commands, so it cannot serve as the platform's custom-command helpcenter. The Workspaces UI therefore also has no stable way to answer “which commands are actually available for this workspace lens?”

## Goals / Non-Goals

**Goals:**
- Add one shared command catalog model that can project the current workspace/avatar CLI surface into both shell and browser surfaces.
- Include `just-bash` builtins explicitly so the catalog matches the real shell contract instead of pretending only app-defined helpers exist.
- Keep runtime CLI command truth descriptor-backed and keep workspace file-backed tool truth filesystem-backed.
- Add a `CLI` workspace mode without changing the existing top-level workbench chrome law.
- Keep arbitrary PATH binaries out of the catalog so the page remains a app/runtime truth surface rather than a generic shell explorer.

**Non-Goals:**
- Replace or override the built-in `help` shell command.
- Build a generic process/package/binary explorer for everything visible on PATH.
- Force every existing workspace tool to become invalid if it lacks sidecar metadata in this round.
- Move long-form command education out of the skill system; skills remain the deeper documentation path.

## Decisions

### 1. Introduce a shared `helpcenter` command instead of trying to override `help`

`just-bash` builtin `help` cannot be safely reused for custom command discovery: it lists builtins only and ignores `defineCommand(...)` entries. The platform therefore needs its own shared discovery command, `helpcenter`, whose data source is the same structured command catalog the browser reads.

Alternatives considered:
- Override `help` directly. Rejected because builtin resolution wins and custom `help` handlers are ignored.
- Parse the text output of bare `help` and `--help`. Rejected because it keeps discovery stringly typed and duplicates truth between shell and browser.

### 2. Model command discovery as a catalog, not as raw shell text

The command surface must answer browser and shell questions with the same data. The catalog therefore becomes the owner of:
- command label
- human description
- surface/group metadata
- optional detail hint such as `help <builtin>` or `<command> --help`
- optional skill reference for deeper documentation

Runtime CLI commands project from the existing descriptor registry. Workspace file-backed tools project from filesystem scan plus optional sidecar metadata. Builtins project from a curated static builtin list because they are stable shell truth, not workspace-owned data.

Alternatives considered:
- Make the browser call shell commands and reparse their stdout. Rejected because feature code should not reverse-engineer shell text.
- Put every command's long-form documentation into the catalog itself. Rejected because the catalog should stay minimal; the skill system already owns deeper docs.

### 3. Keep legacy workspace tools callable, but surface missing registration objectively

The current shell law exposes workspace tool scripts as `tool_*` commands by filename. Tightening that into “metadata required or command unavailable” would be a breaking change across shell behavior and tests. This round therefore keeps legacy callability but makes missing metadata explicit in the catalog through a fallback description.

New tool metadata is read from a sidecar `<tool-file>.cli.json` manifest with `name + description` as the minimum structured fields. When present, that manifest also becomes the right place to add a future `skillRef`.

Alternatives considered:
- Break existing shell behavior and require metadata for command exposure. Rejected for this round because the repo already encodes filename-only callability and no migration path exists yet.
- Hide unregistered tools from the catalog. Rejected because the page must reduce misunderstanding, not create a second hidden command surface.

### 4. Add `CLI` as a workspace mode, not a new primary workbench

The question being answered is workspace-scoped: “what can this workspace lens do?” That belongs inside the existing Workspace workbench beside `Explorer`, `Rules`, and `Private`, sharing the same `View as` avatar control, toolbar search, and compact detail law.

Alternatives considered:
- Create a new top-level primary destination. Rejected because the command surface is workspace-scoped, not a fourth/fifth system alongside Messages or Terminals.
- Add CLI as a detached dialog or drawer. Rejected because it would hide a durable navigation surface behind transient chrome.

## Risks / Trade-offs

- [Risk] Builtin descriptions are less rich than builtin shell help text.
  Mitigation: keep `help <builtin>` as the builtin detail hint and show builtins in a dedicated group.

- [Risk] Legacy tool commands without sidecar metadata still exist.
  Mitigation: surface them with an explicit fallback description so operators see they are callable but under-documented.

- [Risk] Runtime CLI command count is large and could make the page noisy.
  Mitigation: keep grouped sections plus toolbar search, and default to concise row rendering instead of card-heavy presentation.

- [Risk] Shell and browser catalogs could drift if they use separate builders.
  Mitigation: make both `helpcenter` and TRPC read from the same app-server catalog builder.

## Migration Plan

1. Add the new OpenSpec artifacts and durable spec deltas first.
2. Implement the shared app-server command catalog and expose it to shell and browser.
3. Add typed client runtime-store facades for the catalog query.
4. Add the Workspace `CLI` mode UI, group rendering, and search.
5. Update tests for shell discovery, workspace tool metadata, client facades, and WebUI mode behavior.

Rollback strategy:
- Revert the change as one unit if command grouping or shell helpcenter semantics regress. The repo should not keep a partial state where the browser expects a CLI catalog but the shell has no shared source of truth.

## Open Questions

- None. The main architectural uncertainty was whether bare `help` could own custom command discovery, and the runtime evidence already ruled that out.
