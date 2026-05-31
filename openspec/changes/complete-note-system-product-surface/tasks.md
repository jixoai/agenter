## 1. Alignment / Investigation

- [ ] 1.1 Confirm `plans/plan.md` reflects the latest user Q&A: missing NoteSystem skill, missing real-AI validation, Studio `notes` route, and app-shell recording migration away from memory files.
- [ ] 1.2 Confirm `nodes` is treated as `/notes` by default and no code introduces a literal graph-nodes route unless the user corrects the route name.
- [ ] 1.3 Confirm no destructive migration, cleanup, deletion, or automatic conversion of existing memory files is performed in this change.
- [ ] 1.4 Confirm current NoteSystem storage/CLI BDD remains valid and this change adds product surfaces instead of replacing the existing CLI projection law.
- [ ] 1.5 Confirm each future task checkbox is updated only by the agent that completed and verified that task in the current working context.

## 2. BDD Contract

- [ ] 2.1 Add backend NoteSystem API BDD: Scenario: Given notes exist under `AVATAR_HOME` When note catalog is requested Then notebooks, sections, pages, metadata, and capability state are returned without raw Studio filesystem access.
- [ ] 2.2 Add backend NoteSystem API BDD: Scenario: Given a notebook/section/page identity When note page is requested Then metadata and Markdown body are returned, and missing pages return explicit not-found.
- [ ] 2.3 Add backend NoteSystem API BDD: Scenario: Given local notes When note search is requested Then results preserve notebook, section, page, score, snippet, and path metadata.
- [ ] 2.4 Add boundary BDD: Scenario: Given empty `AVATAR_HOME` When note catalog/search/page APIs run Then the response reports no note capability rather than inventing roots.
- [ ] 2.5 Add skill BDD: Scenario: Given built-in runtime skills are listed When the NoteSystem skill is discovered Then `note` appears as a package-owned skill.
- [ ] 2.6 Add skill BDD: Scenario: Given `skill info note` runs When guidance is rendered Then it teaches `note draft`, `note write`, `note list`, `note show`, `note search`, strict writes, and raw-note-not-memory boundaries.
- [ ] 2.7 Add shell prompt BDD: Scenario: Given shell-assistant prompt seed is built When read Then it teaches NoteSystem recording and does not list memory role files as the default recording pack.
- [ ] 2.8 Add shell bootstrap BDD: Scenario: Given default shell-assistant resources are ensured When shell starts Then `AGENTER.mdx` is seeded but memory pack files are not created as default recording assets.
- [ ] 2.9 Add client SDK BDD: Scenario: Given NoteSystem TRPC outputs When runtime-store facades are called Then catalog/page/search outputs preserve typed backend contracts.
- [ ] 2.10 Add Studio state BDD: Scenario: Given no note capability When Notes route state is rendered Then the route exposes a no-capability state.
- [ ] 2.11 Add Studio state BDD: Scenario: Given populated notes When Notes route state is rendered Then notebook/section/page grouping and search result selection are visible.
- [ ] 2.12 Add Studio route BDD: Scenario: Given app shell navigation When `/notes` is available Then the Notes nav item is present and active state follows `/notes`.
- [ ] 2.13 Add real-AI BDD: Scenario: Given a configured real provider When the model is asked to record and retrieve a note Then it uses NoteSystem skill/CLI and verifies the note through `note search` or `note show`.
- [ ] 2.14 Add real-AI provider-gate BDD: Scenario: Given no real provider settings When the real NoteSystem validation suite runs Then it skips with an explicit provider-gate reason.

## 3. Backend / Kernel Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check complete-note-system-product-surface --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [ ] 3.2 Add NoteSystem catalog/page/search output types that represent capability state, readable roots, notebook groups, section groups, page summaries, page detail, and search results.
- [ ] 3.3 Add pure NoteSystem read helpers over existing storage/search primitives without changing note file layout.
- [ ] 3.4 Add AppKernel NoteSystem methods for catalog/page/search derived from the current runtime/avatar workspace capability env.
- [ ] 3.5 Add TRPC `note` router endpoints for catalog, page, and search using zod-typed inputs and outputs.
- [ ] 3.6 Add client-sdk/runtime-store typed facades for NoteSystem catalog, page, and search.
- [ ] 3.7 Keep NoteSystem write ownership CLI-first in this change unless implementation evidence proves Studio editing is required for the current specs.

## 4. Skill / Prompt Implementation

- [ ] 4.1 Add package-owned `packages/app-server/skills/note/SKILL.md`.
- [ ] 4.2 Add focused NoteSystem skill references only if the main skill would become too large; otherwise keep one concise skill file.
- [ ] 4.3 Update built-in skill catalog generation/tests so the package-owned `note` skill is discoverable.
- [ ] 4.4 Update runtime shell guidance only where it references `note`; do not make runtime skill the owner of NoteSystem behavior.
- [ ] 4.5 Update `packages/cli/.agenter/AGENTER.mdx` to replace `Memory pack` guidance with NoteSystem recording guidance.
- [ ] 4.6 Update `apps/shell/src/app-runtime/shell-assistant-seeds.ts` to seed NoteSystem-oriented `AGENTER.mdx` content instead of memory-file recording instructions.
- [ ] 4.7 Update shell bootstrap so default shell-assistant startup no longer creates the old memory pack as default recording assets.
- [ ] 4.8 Preserve existing memory files as user assets; do not delete, migrate, or hide them.

## 5. Studio Notes Route Implementation

- [ ] 5.1 Add `Notes` to Studio app-shell navigation with a lucide icon and active route state for `/notes`.
- [ ] 5.2 Add `/notes` SvelteKit route that delegates to a feature component under `apps/studio/src/lib/features/notes/`.
- [ ] 5.3 Implement Notes route state helpers for capability state, catalog grouping, search query/results, and selected page identity.
- [ ] 5.4 Implement Notes workbench UI using existing Studio workbench/navigation primitives, ScrollView discipline, and no app-server internal imports.
- [ ] 5.5 Render no-capability, empty catalog, populated catalog, search results, loading, and error states.
- [ ] 5.6 Render selected page metadata and Markdown body in a stable detail surface without adding editing or raw frontmatter mutation.
- [ ] 5.7 Add route/component tests for Notes navigation, capability states, grouping, search selection, and page detail.
- [ ] 5.8 Run Svelte autofixer on any new or materially changed Svelte component before finalizing code.

## 6. Real-AI Validation

- [ ] 6.1 Survey existing real-AI provider-gated test patterns and choose the smallest stable harness for NoteSystem.
- [ ] 6.2 Add a real-AI integration test that asks the model to use `skill info note` or equivalent NoteSystem guidance before recording a note.
- [ ] 6.3 Assert the real-AI run writes through projected `note` CLI, not raw filesystem editing.
- [ ] 6.4 Assert the real-AI run retrieves or verifies the note through `note search` or `note show`.
- [ ] 6.5 Ensure missing provider settings skip the test explicitly rather than failing normal CI.

## 7. Durable Specs / Docs

- [ ] 7.1 Sync durable specs for NoteSystem product surface after implementation stabilizes.
- [ ] 7.2 Sync durable specs for Studio Notes workbench and client runtime-store NoteSystem facades.
- [ ] 7.3 Sync shell-assistant/app-shell specs so NoteSystem recording replaces memory-file recording guidance.
- [ ] 7.4 Update package-level `SPEC.md` files where NoteSystem, app-server, app-runtime, shell, or Studio durable contracts changed.
- [ ] 7.5 Add migration notes explaining that legacy memory files are preserved but no longer the default shell-assistant recording surface.

## 8. Verification

- [ ] 8.1 Run targeted NoteSystem storage/CLI/API tests.
- [ ] 8.2 Run targeted runtime skill catalog/guidance tests for the `note` skill.
- [ ] 8.3 Run targeted shell-assistant prompt/bootstrap tests.
- [ ] 8.4 Run targeted client-sdk runtime-store tests for NoteSystem facades.
- [ ] 8.5 Run targeted Studio Notes route/unit tests.
- [ ] 8.6 Run real-AI NoteSystem validation, or record the explicit provider-gated skip output.
- [ ] 8.7 Run `bun run --filter '@agenter/app-server' typecheck`.
- [ ] 8.8 Run `bun run --filter 'agenter-app-studio' typecheck`.
- [ ] 8.9 Run `bun run --filter 'agenter-app-shell' typecheck`.
- [ ] 8.10 Run `bun run typecheck` if shared contracts changed.
- [ ] 8.11 Run `bun run openspec:vision -- validate complete-note-system-product-surface`.
- [ ] 8.12 Run `bun run openspec:vision -- check complete-note-system-product-surface`.
- [ ] 8.13 Run `git diff --check`.

## 9. Self-Review Loop

- [ ] 9.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, and tasks.
- [ ] 9.2 Generate separate `review/self-review.html` for command evidence, route/API contract evidence, skill guidance evidence, and real-AI output/skip evidence.
- [ ] 9.3 If self-review changes OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 9.4 If the review enters a real loop, run `bun run openspec:vision -- review-state complete-note-system-product-surface` to persist iteration / recurrence state.
- [ ] 9.5 If review cannot exit normally, run `bun run openspec:vision -- handoff complete-note-system-product-surface` and commit the handoff evidence before returning to user discussion.
- [ ] 9.6 If review exits normally, archive the change and commit the archive result.
