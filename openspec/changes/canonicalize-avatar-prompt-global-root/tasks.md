## 1. Spec And Contract Cleanup

- [x] 1.1 Update `packages/app-server/SPEC.md` so Avatar-authored prompt truth is only `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`.
- [x] 1.2 Update `packages/product-extension-runtime/SPEC.md` so product prompt seed/read identity is global Avatar canonical root only.
- [x] 1.3 Add or update OpenSpec capability specs proving workspace-local `AGENTER.mdx` cannot shadow the global Avatar prompt.
- [x] 1.4 Annotate or supersede stale active-change wording that still shows `[~|<workspace>]/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`.

## 2. Runtime Prompt Root Implementation

- [x] 2.1 Change `resolveSessionConfig` so `prompt.rootDir`, `prompt.privateRootDir`, and `prompt.agenterPath` use only `resolveGlobalAvatarCanonicalRoot(...)` when `avatarPrincipalId` is known.
- [x] 2.2 Change app-kernel prompt seed resolution so `ensureAvatarPromptSeed` always writes `AGENTER.mdx` under the global Avatar canonical root.
- [x] 2.3 Audit `session.avatarPrincipalId` creation and startup paths to ensure the prompt principal is the global Avatar principal, not an accidental workspace seat principal.
- [x] 2.4 If runtime still needs a workspace seat credential principal, model it separately from the global Avatar prompt principal.
- [x] 2.5 Keep Slot implementation unchanged; adjust only the root context passed into prompt loading when needed.

## 3. Product API And SDK Surface

- [x] 3.1 Remove `workspacePath` from `productAvatarPromptSeedInputSchema`.
- [x] 3.2 Update product-extension runtime client/store types so prompt seed cannot be called with `workspacePath`.
- [x] 3.3 Update cli-shell bootstrap so shell-assistant prompt seed does not pass `workspacePath`.
- [x] 3.4 Leave memory pack and workspace-private asset APIs unchanged unless tests need naming cleanup to avoid implying prompt authority.

## 4. BDD Regression Coverage

- [x] 4.1 Add session-config coverage where global and workspace-local `AGENTER.mdx` both exist and the runtime chooses the global prompt.
- [x] 4.2 Add product-extension coverage proving prompt seed writes global root even when launched from a project workspace.
- [x] 4.3 Update app-kernel/settings-editor coverage so edits and reads target global canonical prompt paths.
- [x] 4.4 Update client-sdk and cli-shell fake stores so prompt seed state is keyed by global Avatar principal only.
- [x] 4.5 Keep or rewrite prompt-store Slot tests as Slot composition tests, not workspace prompt-root authority tests.

## 5. Local Filesystem Cleanup

- [x] 5.1 Inventory `~/Dev/GitHub/jixoai-labs/agenter/.agenter` and `~/.agenter`, focusing on `AGENTER.mdx`, `avatars/by-principal`, `avatars/by-nickname`, and stale workspace prompt roots.
- [x] 5.2 Before deleting anything, record a concise cleanup plan listing paths, reason, and whether each path is obsolete prompt residue or preserved non-prompt data.
- [x] 5.3 Delete or move obsolete local workspace prompt roots after tests prove they are no longer runtime prompt truth.
- [x] 5.4 Preserve global canonical Avatar `AGENTER.mdx` files and any memory/skill/workspace-private files whose ownership is outside this change.
- [x] 5.5 Record after-cleanup evidence so future debugging does not confuse old workspace prompt residue with active law.

## 6. Verification

- [x] 6.1 Run targeted app-server tests for session config, product-extension runtime, app-kernel prompt editing, and prompt-store.
- [x] 6.2 Run targeted client-sdk and cli-shell tests covering prompt seed call sites.
- [x] 6.3 Run `openspec validate canonicalize-avatar-prompt-global-root --strict`.
- [x] 6.4 Run the minimal real local smoke path: launch from a workspace containing stale local prompt residue and verify the runtime reads the global Avatar `AGENTER.mdx`.
