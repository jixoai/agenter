## Context

Today only the avatar root workspace holds the credential-bearing runtime-local control plane. Mounted project workspaces are filesystem authorities, not system owners. The user wants the opposite long-term direction: let files declare the systems a workspace carries, then let those systems become attention-aware runtime participants.

This future design must answer four hard questions that the current refactor intentionally avoids:

1. how `settings.local.json` declares system instances and token locations
2. how secrets are loaded and scoped safely
3. how mounted systems publish/mute/resume AttentionContexts
4. how shell/runtime control re-plans muted contexts after remount

## Goals / Non-Goals

**Goals**

- make mounted workspaces file-first system carriers
- instantiate systems from workspace-local settings instead of root-only injection
- let those systems contribute AttentionContexts through the same shared attention law
- make unmount/remount affect context visibility through mute/resume semantics rather than deletion

**Non-Goals**

- do not implement this inside the current shell refactor
- do not assume every mounted workspace automatically receives root CLI or root credentials

## Decisions

### 1. Files are the first source of truth

Mounted workspace systems will be discovered from workspace files, starting with `settings.local.json`, rather than from root-owned prompt glue or implicit runtime defaults.

### 2. Systems publish AttentionContexts through adapters

Each mounted System must integrate through an attention adapter rather than writing ad-hoc prompt text. Attention remains the shared snapshot/reminder law.

### 3. Unmount means mute, not erase

Unmounting a workspace should mute related AttentionContexts so history remains durable and the runtime can later resume or re-plan them after remount.

### 4. This change may require another shell law revision

Once mounted workspaces can own systems and tokens, the current `root_bash` specialness may become unnecessary. That future symmetry should be evaluated only after the mounted-system law exists.
