## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` reflects the latest user Q&A, code survey, existing OpenSpec survey, and the decision to use a new change rather than extending `align-avatar-memory-scope-law`.
- [x] 1.2 Confirm the user-approved strict invalid `AVATAR_HOME` behavior is represented in specs and BDD.
- [x] 1.3 Confirm first apply does not rename, remove, or reimplement the visible `root_bash` tool surface.
- [x] 1.4 Confirm `scriptSystem` stays postponed as a script source/home projection rather than becoming a full System.
- [x] 1.5 Confirm `noteSystem` is included with SkillSystem as the basic capability projection validation target.
- [x] 1.6 Confirm NoteSystem uses Markdown + frontmatter, notebook -> section -> page hierarchy, special draft notebook, strict write modes, and lightweight JS search.
- [x] 1.7 Confirm final note-cli command shape: `note write`, `note draft`, `note list`, `note show`, and `note search`.
- [x] 1.8 Confirm each future task checkbox is updated only by the agent that completed and verified that task in the current working context.

## 2. BDD Contract

- [x] 2.1 Add parser BDD: Scenario: Given empty `AVATAR_HOME` When parsed Then it returns `[]` and no filesystem side effect occurs.
- [x] 2.2 Add parser BDD: Scenario: Given semicolon-delimited absolute `AVATAR_HOME` When parsed Then entries preserve last-wins order.
- [x] 2.3 Add parser BDD: Scenario: Given non-Windows colon-delimited `AVATAR_HOME` When parsed Then it is accepted as compatibility input and serialized back with `;`.
- [x] 2.4 Add parser BDD: Scenario: Given a relative `AVATAR_HOME` entry When parsed or set Then the request is rejected before capability projection.
- [x] 2.5 Add WorkspaceSystem BDD: Scenario: Given a workspace instance with inherited Avatar home When `getAvatarHome()` runs Then it returns normalized absolute paths.
- [x] 2.6 Add WorkspaceSystem BDD: Scenario: Given `setAvatarHome()` is called with duplicate paths When env is persisted Then the duplicate keeps the last occurrence and canonical `;` serialization.
- [x] 2.7 Add capability BDD: Scenario: Given a per-command env overlay includes `AVATAR_HOME` When workspace capabilities are inspected Then the overlay does not grant durable private CLI capability.
- [x] 2.8 Add skill BDD: Scenario: Given one workspace group with `PWD` and `AVATAR_HOME` When `SKILLS_HOME` is derived Then PWD roots appear before Avatar-home roots and Avatar-home conflicts win.
- [x] 2.9 Add skill BDD: Scenario: Given empty `AVATAR_HOME` and a PWD with local skills When skill list runs Then PWD skills are visible and avatar-private roots are not invented.
- [x] 2.10 Add skill BDD: Scenario: Given generic and dot-agent skills with the same name When merged Then the later dot-agent source wins and the visible record reports its source path.
- [x] 2.11 Add multi-workspace skill BDD: Scenario: Given two workspace groups When `SKILLS_HOME` is derived Then the order is `w1-pwd;w1-avatar-home;w2-pwd;w2-avatar-home`.
- [x] 2.12 Add NoteSystem BDD: Scenario: Given empty `AVATAR_HOME` When note CLI projection runs Then avatar-private note CLI is withheld.
- [x] 2.13 Add NoteSystem BDD: Scenario: Given non-empty `AVATAR_HOME` When a note is written Then it is stored as a note fact, not a memory projection.
- [x] 2.14 Add NoteSystem BDD: Scenario: Given notebook/section/page input When a note page is written Then a Markdown + frontmatter page is stored under that hierarchy.
- [x] 2.15 Add NoteSystem BDD: Scenario: Given unsafe note path segments When `note write` runs Then traversal/control/path separator names are rejected.
- [x] 2.16 Add NoteSystem BDD: Scenario: Given `note draft` When content is captured Then the special draft notebook uses date section and high-precision time plus short-id page naming.
- [x] 2.17 Add NoteSystem BDD: Scenario: Given a non-empty page When `note write` runs without append or override mode Then a conflict error is returned and content is unchanged.
- [x] 2.18 Add NoteSystem BDD: Scenario: Given a non-empty page When append mode is used Then content is appended and metadata is updated.
- [x] 2.19 Add NoteSystem BDD: Scenario: Given a non-empty page When override mode is used Then body content is replaced while page identity remains stable.
- [x] 2.20 Add NoteSystem BDD: Scenario: Given local notes When `note search` runs Then lightweight JS search returns notebook, section, page, score, and snippet metadata without external services.
- [x] 2.21 Add NoteSystem BDD: Scenario: Given another mounted workspace has notes When `note list/show/search` runs Then only the current workspace group is used by default.
- [x] 2.22 Add boundary BDD: Scenario: Given a workspace gains or loses projected CLIs When inspected Then the change is reported as a capability projection, not an external side effect.
- [x] 2.23 Add compatibility BDD: Scenario: Given this change applies When runtime tool descriptors are inspected Then existing `root_bash` visible naming is not renamed or removed.

## 3. Platform Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check define-workspace-env-capability-projection --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [x] 3.2 Add a pure env utility module with `parseEnvAvatarHome`, canonical `serializeEnvAvatarHome`, absolute path validation, last-wins dedupe, and platform-aware delimiter reading.
- [x] 3.3 Add pure `deriveEnvSkillsHome` / multi-workspace skill-home utilities that expand each workspace group as `pwd` roots before `avatarHome` roots, with `skills`, `.codex/skills`, `.claude/skills`, and `.agents/skills` expansion and no filesystem mutation.
- [x] 3.4 Extend WorkspaceSystem data shape so workspace instances/mounts can persist capability env separately from exec-profile process env.
- [x] 3.5 Add `workspace.getAvatarHome()` and `workspace.setAvatarHome(paths)` on the workspace instance API boundary.
- [x] 3.6 Update workspace creation flows so inherited `AVATAR_HOME` is explicit and workspace instances can opt out with an empty value.
- [x] 3.7 Update capability projection consumers without renaming/removing `root_bash`; any root bash law cleanup must be proposed separately.

## 4. SkillSystem Migration

- [x] 4.1 Replace `RuntimeSkillLookupInput.rootWorkspacePath` authority with `SKILLS_HOME` / skill source list authority.
- [x] 4.2 Update runtime skill merge logic so all file-backed skills follow the derived source ordering and last-wins conflict law.
- [x] 4.3 Keep built-in/plugin skills as explicit read-only providers merged through the same source ordering model.
- [x] 4.4 Update `skill list/search/info/upsert/remove/config` commands to explain and use env-derived source paths.
- [x] 4.5 Update Skill Browser / Studio skill surfaces so visible skills report their `SKILLS_HOME` source instead of global/project grouping heuristics.
- [x] 4.6 Add migration notes for existing `rootWorkspacePath/skills` data so user-owned skills are not silently lost.

## 5. NoteSystem And System CLI Projection

- [x] 5.1 Define a typed system CLI projection contract over workspace instance env/capabilities.
- [x] 5.2 Add workspace lifecycle hooks for created/updated/detached workspace instances to recompute CLI projections.
- [x] 5.3 Project skill CLI through the new contract while preserving SkillSystem's special PWD-local discovery law.
- [x] 5.4 Add NoteSystem storage primitives for Markdown + frontmatter pages under notebook / section / page paths.
- [x] 5.5 Add `note` CLI projection only when the active workspace group has non-empty `AVATAR_HOME`.
- [x] 5.6 Implement `note write --notebook --section --page --mode append|override`, including safe segment validation.
- [x] 5.7 Implement `note draft` to write into `_draft` with date section and high-precision time plus short-id page naming.
- [x] 5.8 Implement `note list`, `note show`, and current-workspace-group default read scope.
- [x] 5.9 Add strict write modes so non-empty page writes require append or override.
- [x] 5.10 Add lightweight local `note search`, using MiniSearch by default unless implementation evidence favors another local JS search library.
- [x] 5.11 Keep script capability as script source/home projection only, unless a later user decision promotes it to full System.
- [x] 5.12 Ensure capability projection changes are inspectable and do not create hidden messages, file writes, terminal input, or note entries.

## 6. Durable Specs / Docs

- [x] 6.1 Sync the accepted Env-first law into the relevant durable `SPEC.md` files after implementation stabilizes.
- [x] 6.2 Update `openspec/specs/workspace-resource-ownership/spec.md` so root/private specialness is an env projection rather than an ownership label.
- [x] 6.3 Update package-level specs for WorkspaceSystem, SkillSystem/runtime skills, and runtime system boundary law as needed.
- [x] 6.4 Update Shell/product prompt guidance only where SkillSystem/NoteSystem wording changes; do not teach a `root_bash` rename in this change.

## 7. Verification

- [x] 7.1 Run targeted env parser and WorkspaceSystem tests.
- [x] 7.2 Run targeted runtime skill tests and Skill Browser tests.
- [x] 7.3 Run targeted NoteSystem note CLI/storage/search tests.
- [x] 7.4 Run targeted runtime CLI/tool-provider tests proving existing `root_bash` naming remains stable while new capability projection tests pass.
- [x] 7.5 Run targeted Shell bootstrap/runtime tests proving project workspace remains a tool surface, not capability authority.
- [x] 7.6 Run `bun run --filter '@agenter/app-server' typecheck`.
- [x] 7.7 Run `bun run typecheck` if the implementation touches shared contracts.
- [x] 7.8 Run `bun run openspec:vision -- validate define-workspace-env-capability-projection`.
- [x] 7.9 Run `bun run openspec:vision -- check define-workspace-env-capability-projection`.

## 8. Self-Review Loop

- [x] 8.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and tasks.
- [x] 8.2 Generate separate `review/self-review.html` for command evidence, source-order examples, and compatibility alias proof if applicable.
- [x] 8.3 If self-review changes OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [x] 8.4 If the review enters a real loop, run `bun run openspec:vision -- review-state define-workspace-env-capability-projection` to persist iteration / recurrence state.
- [x] 8.5 If review cannot exit normally, run `bun run openspec:vision -- handoff define-workspace-env-capability-projection` and commit the handoff evidence before returning to user discussion.
- [x] 8.6 If review exits normally, archive the change and commit the archive result.
