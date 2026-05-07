## Prompt-to-Artifact Coverage Audit

This audit maps the user's explicit prompt requirements to concrete OpenSpec evidence. It is part of the change record so later implementation does not depend on conversation memory.

## Objective

Write only OpenSpec change artifacts for `add-cli-shell-product`; do not write implementation code. The change should capture enough product, platform, TUI, package-resolution, local-test, and validation detail to guide implementation.

## Checklist

| Prompt requirement | Artifact evidence | Status |
| --- | --- | --- |
| Build ordinary-user products on top of Agenter platform rather than exposing only superadmin WebUI | `proposal.md` Why / What Changes; `design.md` Goals | Covered |
| cli-shell must be an extension module and must not pollute core modules | `proposal.md` New capability `product-extension-runtime`; `design.md` Context / Decision 2.2; `specs/product-extension-runtime/spec.md` core isolation requirement; `tasks.md` 0.1 / 0.2 | Covered |
| This change must define reusable programmable capability, not only cli-shell UI | `specs/product-extension-runtime/spec.md` extension descriptor/resource/attention/delegation requirements; `design.md` Decision 2.2; `tasks.md` group 0 | Covered |
| Core modules may only support cli-shell through programmable interfaces | `specs/product-extension-runtime/spec.md`; `specs/product-command-launcher/spec.md` descriptor scenarios; `tasks.md` 0.2 / 1.1 / 2.5 | Covered |
| External cli-shell package should consume daemon/client-sdk style contracts rather than importing core internals, even in local workspace testing | `design.md` Decision 2.2; `specs/product-extension-runtime/spec.md` product consumes runtime scenario; `tasks.md` 0.11 / 2.5 | Covered |
| Before implementation starts, discipline must be recorded: platform laws first, no core imports from cli-shell, write-capable managed mode using terminal authority, prompt/memory seed-if-missing, deterministic plus long-running real AI validation | `design.md` Implementation Discipline | Covered |
| Provide a developer-facing shell/TUI product | `proposal.md` New capability `cli-shell-product`; `design.md` Context | Covered |
| `agenter shell` starts shell product and summons/ensures default Avatar `@shell-assistant` | `specs/cli-shell-product/spec.md` default shell assistant scenarios | Covered |
| Explicit `agenter shell @default` remains supported as an Avatar override | `specs/cli-shell-product/spec.md` explicit Avatar override scenario | Covered |
| Auto-created `@shell-assistant` must have AGENTER.mdx prompt guidance for flexible pair programming, user understanding, self-evolution, and managed autonomy | `specs/shell-assistant-avatar/spec.md` prompt requirement; `design.md` prompt/memory law | Covered |
| `@shell-assistant` must maintain dedicated memory files linked from AGENTER.mdx | `specs/shell-assistant-avatar/spec.md` memory requirement; `design.md` default memory roles; `tasks.md` 2.8 | Covered |
| Shell-assistant memory must include current hosting objective for compact continuity | `specs/shell-assistant-avatar/spec.md` hosting objective memory scenario; `design.md` memory roles | Covered |
| Shell-assistant prompt and memory files should remain openly editable user assets, not locked product-owned state | `design.md` prompt/memory law and Decision 5; `specs/shell-assistant-avatar/spec.md` existing resources scenario; `tasks.md` 2.7 / 2.9 | Covered |
| Self-evolution is orthogonal to managed mode and can run from normal conversation, user correction, post-work review, or a product/assistant-composed attention-cli loop | `specs/shell-assistant-avatar/spec.md` self-evolution scenario; `specs/product-extension-runtime/spec.md` programmable attention requirement; `design.md` prompt/memory law and Decision 5.2 | Covered |
| `auto-dream` is only an example name, not a built-in core feature, fixed score key, or required product command | `design.md` corrected prompt/memory law and Decision 5.2; `specs/product-extension-runtime/spec.md` self-evolution attention scenario; `specs/shell-assistant-avatar/spec.md` self-evolution scenario; `tasks.md` 0.9 / 2.11 | Covered |
| Since this change improves kernel programmability, attention-cli should support minimal commit/query/settle for assistant-composed self-evolution loops and defer richer watch/schedule primitives to a future change | `proposal.md` product-extension-runtime capability; `design.md` Decision 2.2 / 5.2; `specs/product-extension-runtime/spec.md` programmable attention requirement; `tasks.md` 0.9 / 0.10; `openspec/changes/extend-attention-cli-self-evolution-runtime/` | Covered |
| Collaboration styles may vary: senior-led, requirement-led/junior-like, playful/companion-like, or otherwise idiosyncratic | `design.md` Decision 5.1; `specs/shell-assistant-avatar/spec.md` collaboration scenarios; `tasks.md` 2.10 / 5.9 | Covered |
| Shell-assistant must learn collaboration style from evidence instead of assuming fixed archetypes | `specs/shell-assistant-avatar/spec.md` prompt and collaboration scenarios; `design.md` Decision 5.1; `tasks.md` 2.10 / 5.9 | Covered |
| Real AI tests must evaluate whether shell-assistant can self-evolve and whether the direction is correct | `proposal.md` What Changes; `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md` AI judge requirement; `tasks.md` 5.7-5.9 | Covered |
| AI evaluation should use existing semantic judge tooling and a scoring rubric | `packages/app-server/src/semantic-judge.ts` evidence; `packages/app-server/test-support/real-semantic-judge.ts` evidence; `design.md` Decision 5.3; `tasks.md` 5.7 | Covered |
| Prompt usefulness and learned behavior require long-running real AI scripts; deterministic-only tests are insufficient for this acceptance path | `design.md` stable real-AI testing law and Decision 5.3; `specs/shell-assistant-avatar/spec.md` long-running scripts scenario; `tasks.md` 5.7 / 5.11 | Covered |
| Real AI suites may be gated from normal CI and may use existing model-response cache, but remain meaningful product validation | `packages/app-server/test-support/real-model-cache.ts` evidence; `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md` long-running scripts scenario; `tasks.md` 5.11 | Covered |
| Below-threshold AI judge scores should trigger retries; two retries still failing means prompt or bug issue | `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md` low-score retry scenario; `tasks.md` 5.8 | Covered |
| Prompt overfitting to a specific AI test fixture is forbidden | `proposal.md` anti-overfit rule; `design.md` Decision 5.3 and Risks; `specs/shell-assistant-avatar/spec.md` anti-overfit requirement; `tasks.md` 5.7 / 5.10 | Covered |
| Development contradictions, pain points, idealized-assumption gaps, and product/runtime tensions should be recorded under `.chat/add-cli-shell-product/` | `proposal.md` What Changes / Impact; `design.md` Decision 5.3 / Migration Plan; `specs/shell-assistant-avatar/spec.md` contradiction scenario; `tasks.md` 5.10 | Covered |
| `shell` command is not bundled behavior inside core CLI; it resolves `@agenter/cli-shell` package bin | `specs/product-command-launcher/spec.md` launch package requirement; `design.md` Decision 1 | Covered |
| Auto launch without install prompt | `specs/product-command-launcher/spec.md` remote npm fallback scenario | Covered |
| Local monorepo tests must launch workspace package first | `specs/product-command-launcher/spec.md` local-first requirement; `tasks.md` 1.2 / 1.5 | Covered |
| Product launcher must pass daemon/auth context instead of product rediscovery | `specs/product-command-launcher/spec.md` env contract scenarios; `tasks.md` 1.6 | Covered |
| Early prompt mentions `~/.agenter` port discovery, but cli-shell must not create a second daemon discovery authority | `design.md` Corrected prompt distillation; `specs/product-command-launcher/spec.md` product daemon context scenarios | Covered |
| Remote fallback must be automatic but controlled | `specs/product-command-launcher/spec.md` runner abstraction and registry scenarios; `tasks.md` 1.7 | Covered |
| `terminalSystem` owns internal terminal instances | `design.md` Terminology; `specs/cli-shell-product/spec.md` durable internal terminal requirement | Covered |
| `--session=1` maps only to product terminal name `shell-1` | `specs/cli-shell-product/spec.md` numeric/default session scenarios | Covered |
| Repeated `agenter shell` reuses default instance | `specs/cli-shell-product/spec.md` repeated launch / existing terminal / room reuse scenarios | Covered |
| Multiple terminals require explicit `--session=<name>` and another shell-terminal, not one in-product manager | `specs/cli-shell-product/spec.md` one shell-terminal binding requirement | Covered |
| Default product login uses superadmin | `specs/cli-shell-product/spec.md` superadmin product login requirement | Covered |
| Early prompt mentions `terminal-assistant`; the current default assistant is concrete `@shell-assistant`, while explicit `@avatar` still overrides | `design.md` Corrected prompt distillation; `specs/cli-shell-product/spec.md` default shell assistant and explicit override scenarios | Covered |
| Product creates/reuses a terminal instance and room instance | `specs/cli-shell-product/spec.md` durable internal terminal and durable room requirements | Covered |
| Room ids remain backend allocated, not `shell-1` as durable id | `design.md` Decision 6; `specs/cli-shell-product/spec.md` durable room requirement | Covered |
| Visual effect must only intrude at the bottom | `assets/cli-shell-product-reference-v8-toolbar-grid.png`; `assets/cli-shell-product-reference-v8-toolbar-grid.svg`; `assets/cli-shell-product-reference-v8-toolbar-grid.txt`; `design.md` Decision 7; `specs/cli-shell-product/spec.md` bottom-only toolbar requirement | Covered |
| Default intrusion should be one line, with separator optional and background preferred | `design.md` Decision 7; `specs/cli-shell-product/spec.md` one-line toolbar scenarios; `assets/cli-shell-product-reference-v8-toolbar-grid.png`; `assets/cli-shell-product-reference-v8-toolbar-grid.txt` | Covered |
| Toolbar must be status icon, current Heartbeat, operation buttons | `design.md` Decisions 7 / 7.1 / 7.2; `specs/cli-shell-product/spec.md` toolbar requirements; `assets/cli-shell-product-reference-v8-toolbar-grid.png`; `assets/cli-shell-product-reference-v8-toolbar-grid.txt` | Covered |
| TUI effect must be drawn as terminal character grid rather than Web/pixel-card UI | `design.md` corrected prompt distillation and Decision 7; `specs/cli-shell-product/spec.md` terminal cell rendering scenario; `assets/cli-shell-product-reference-v8-*-grid.png`; `assets/cli-shell-product-reference-v8-*-grid.svg`; `assets/cli-shell-product-reference-v8-*-grid.txt`; `tasks.md` 4.17 | Covered |
| Status must cover idle, text-progressing, thinking, toolcall, message tool, terminal tool | `design.md` Decision 7.1; `specs/cli-shell-product/spec.md` status icon scenario; `tasks.md` 4.5 | Covered |
| Current Heartbeat is latest streaming message-part and optimizes built-in tools | `design.md` Decision 7.1; `specs/cli-shell-product/spec.md` Heartbeat scenarios; `tasks.md` 4.6 | Covered |
| Operation buttons are managed toggle and chat entry with unread count/shortcut | `design.md` Decision 7.2; `specs/cli-shell-product/spec.md` action button scenario; `tasks.md` 4.7 | Covered |
| Managed/takeover should be attention-backed and not local UI state | `design.md` corrected prompt distillation and Decision 7.2; `specs/shell-assistant-avatar/spec.md` hosting AttentionItem requirement; `specs/product-extension-runtime/spec.md` product attention/delegation requirements; `specs/cli-shell-product/spec.md` managed hosting/delegation requirement; `tasks.md` 0.6 / 4.19 / 4.20 | Covered |
| Managed on commits the fixed key `scores: {"hosting": 1000}` and managed off forces `scores: {"hosting": 0}` | `specs/shell-assistant-avatar/spec.md` hosting AttentionItem scenarios; `specs/product-extension-runtime/spec.md` managed hosting and revoke scenarios; `tasks.md` 0.6 / 4.19 / 4.20 | Covered |
| Hosting attention schedules work but does not itself grant terminal write authority | `specs/shell-assistant-avatar/spec.md` hosting authority scenario; `specs/product-extension-runtime/spec.md` delegation requirement; `tasks.md` 4.21 | Covered |
| Managed/takeover mode should allow terminal write by default because write autonomy is the core value of hosting | `design.md` Decision 7.2; `specs/product-extension-runtime/spec.md` managed delegation scenario; `specs/cli-shell-product/spec.md` managed delegation scenario; `tasks.md` 4.19 / 4.21 | Covered |
| Autonomous terminal writes must be attributable to Avatar and delegation, not hidden superadmin | `specs/product-extension-runtime/spec.md` autonomous write provenance scenario; `specs/cli-shell-product/spec.md` autonomous write scenario; `tasks.md` 4.21 | Covered |
| Product should include a dialogue panel drawn on the right side for review | `design.md` Decision 9; `specs/cli-shell-product/spec.md` explicit dialogue panel requirement; `assets/cli-shell-product-reference-v8-dialogue-right-grid.png`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.svg`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt` | Covered |
| Docked chat panel should not have a full enclosing border; it should use left/right or top/bottom separators to save terminal cells | `design.md` corrected prompt distillation and Decisions 7 / 9; `specs/cli-shell-product/spec.md` docked separator scenario; `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt`; `tasks.md` 4.10 / 4.17 | Covered |
| Dialogue panel top toolbar has placement buttons and close button | `design.md` Decision 9; `specs/cli-shell-product/spec.md` dialogue toolbar scenario; `tasks.md` 4.9 | Covered |
| Dialogue panel middle list renders Markdown with left gutter and right scrollbar | `specs/cli-shell-product/spec.md` message list scenario; `tasks.md` 4.10 | Covered |
| User messages use gray background and `>` gutter marker | `specs/cli-shell-product/spec.md` message list scenario; `tasks.md` 4.10 | Covered |
| Dialogue messages render short time metadata | `design.md` Decision 9; `specs/cli-shell-product/spec.md` short time scenario; `tasks.md` 4.18 | Covered |
| Dialogue inserts a centered date divider row when local date changes | `design.md` Decision 9; `specs/cli-shell-product/spec.md` date divider scenario; `tasks.md` 4.18 | Covered |
| Dialogue panel bottom input is focused and has gray background, one-line separator, `>` gutter, cursor | `specs/cli-shell-product/spec.md` input scenario; `tasks.md` 4.11 | Covered |
| Dialogue panel supports left/right/floating/bottom placement with smart initial and resize decisions | `design.md` Decision 9.1; `specs/cli-shell-product/spec.md` smart placement requirement; `tasks.md` 4.12 | Covered |
| No left rail, shell/session list, top chrome, or right transcript pane | `specs/cli-shell-product/spec.md` bottom-only scenarios | Covered |
| Normal terminal input remains primary | `design.md` Decision 8; `specs/cli-shell-product/spec.md` terminal input ownership requirement | Covered |
| Bottom composer does not leak text into backend terminal | `specs/cli-shell-product/spec.md` explicit composer focus scenarios | Covered |
| Resize should preserve bottom-only geometry | `design.md` Decision 10; `specs/cli-shell-product/spec.md` geometry requirement | Covered |
| Cli-shell exit should detach instead of deleting durable resources | `design.md` Decision 11; `specs/cli-shell-product/spec.md` detach requirement | Covered |
| Cli-shell must not inherit dashboard/session-list IA from existing `@agenter/tui` | `design.md` Decision 12; `tasks.md` 4.2 | Covered |
| Validation should cover real walkthrough and targeted tests | `tasks.md` Validation section | Covered |

## Current Weak Points

- No known uncovered requirement remains.
- The final visual target is the v8 PNG/SVG/TXT reference set. v7 and earlier exploration files are intentionally absent from final-review assets.
- The v8 PNGs are the accepted product-effect references; the v8 SVG files are deterministic inspection/regeneration companions; the v8 `.txt` grids are auxiliary terminal render contracts.
- Latest refinement removes the full enclosing docked chat-panel border and keeps only terminal/chat plus internal region separators.

## Completion Audit

Objective restatement:

- Capture the `add-cli-shell-product` product command, platform integration, TUI IA, visual references, and validation plan in OpenSpec artifacts only.
- Do not write implementation code during this discussion thread.
- Keep every clarified product decision in the change record so implementation does not depend on conversation memory.
- Treat the change as fully ready only after the effect references and requirements match the user's expectation.

| Success criterion | Evidence inspected | Result |
| --- | --- | --- |
| Only OpenSpec change artifacts are changed | Current work is confined to `openspec/changes/add-cli-shell-product/` | Satisfied |
| Product launcher law is specified | `specs/product-command-launcher/spec.md`; `tasks.md` group 1 | Satisfied |
| Product extension runtime law is specified | `specs/product-extension-runtime/spec.md`; `design.md` Decision 2.2; `tasks.md` group 0 | Satisfied |
| Core/product isolation is specified | `specs/product-extension-runtime/spec.md`; `specs/product-command-launcher/spec.md`; `tasks.md` 0.2 / 1.1 / 2.5 | Satisfied |
| External package consumption boundary is specified | `design.md` Decision 2.2; `specs/product-extension-runtime/spec.md`; `tasks.md` 0.11 | Satisfied |
| Implementation discipline is specified | `design.md` Implementation Discipline | Satisfied |
| Shell-assistant prompt/memory initialization is specified | `specs/shell-assistant-avatar/spec.md`; `design.md` prompt/memory law; `tasks.md` 2.7-2.9 | Satisfied |
| Shell-assistant prompt/memory openness is specified | `design.md` Decision 5; `specs/shell-assistant-avatar/spec.md`; `tasks.md` 2.7 / 2.9 | Satisfied |
| Shell-assistant collaboration-style variance is specified | `design.md` Decision 5.1; `specs/shell-assistant-avatar/spec.md` senior-led / requirement-led / playful scenarios; `tasks.md` 2.10 / 5.9 | Satisfied |
| Self-evolution is specified as programmable attention behavior, not built-in `auto-dream` | `design.md` Decision 5.2; `specs/product-extension-runtime/spec.md` programmable attention requirement; `specs/shell-assistant-avatar/spec.md` self-evolution scenario; `tasks.md` 0.9 / 2.11 | Satisfied |
| Real AI semantic evaluation and retry policy are specified | `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md` AI judge requirement; `tasks.md` 5.7 / 5.8 | Satisfied |
| Long-running real AI script validation is specified | `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md`; `tasks.md` 5.11 | Satisfied |
| Anti-overfit and contradiction logging governance is specified | `proposal.md`; `design.md` Decision 5.3; `specs/shell-assistant-avatar/spec.md` anti-overfit requirement; `tasks.md` 5.10 | Satisfied |
| Local-first workspace package resolution is specified | `specs/product-command-launcher/spec.md`; `tasks.md` 1.2 / 1.5 | Satisfied |
| Daemon/auth context is launcher-owned, not product-local rediscovery | `design.md` corrected prompt distillation; `specs/product-command-launcher/spec.md` daemon context scenarios; `tasks.md` 1.8 | Satisfied |
| Avatar mention, shell name, and AvatarRuntime identity are separated | `specs/cli-shell-product/spec.md`; `specs/avatar-runtime-topology/spec.md` | Satisfied |
| Historical terminal-assistant role cannot override explicit `@avatar` grammar | `design.md` corrected prompt distillation; `specs/cli-shell-product/spec.md` historical role scenario; `tasks.md` 2.6 | Satisfied |
| One shell-terminal binds one backend terminal | `design.md` terminology and Decision 7; `specs/cli-shell-product/spec.md` one shell-terminal requirement | Satisfied |
| Bottom-only one-row toolbar IA is specified | `design.md` Decision 7; `specs/cli-shell-product/spec.md` bottom-only toolbar requirement; `assets/cli-shell-product-reference-v8-toolbar-grid.png`; `assets/cli-shell-product-reference-v8-toolbar-grid.svg`; `assets/cli-shell-product-reference-v8-toolbar-grid.txt` | Satisfied |
| Toolbar zones and state projection are specified | `design.md` Decisions 7.1 / 7.2; `specs/cli-shell-product/spec.md` toolbar requirement; `tasks.md` 4.4-4.7 | Satisfied |
| Managed/takeover hosting attention and delegation are specified | `design.md` Decision 7.2; `specs/shell-assistant-avatar/spec.md` hosting AttentionItem requirement; `specs/product-extension-runtime/spec.md` attention/delegation requirements; `specs/cli-shell-product/spec.md` managed hosting/delegation requirement; `tasks.md` 0.6 / 4.19-4.21 | Satisfied |
| Managed mode write-capable default is specified | `design.md` Decision 7.2; `specs/product-extension-runtime/spec.md`; `specs/cli-shell-product/spec.md`; `tasks.md` 4.19 / 4.21 | Satisfied |
| Terminal-grid rendering law is specified | `design.md` corrected prompt distillation and Decision 7; `specs/cli-shell-product/spec.md` terminal cell rendering scenario; `tasks.md` 4.17; `assets/cli-shell-product-reference-v8-*-grid.png`; `assets/cli-shell-product-reference-v8-*-grid.svg`; `assets/cli-shell-product-reference-v8-*-grid.txt` | Satisfied |
| Dialogue panel structure and smart placement are specified | `design.md` Decisions 9 / 9.1; `specs/cli-shell-product/spec.md` dialogue requirements; `tasks.md` 4.8-4.12; `assets/cli-shell-product-reference-v8-dialogue-right-grid.png`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.svg`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt` | Satisfied |
| Docked dialogue panel avoids full enclosing border | `design.md` Decisions 7 / 9; `specs/cli-shell-product/spec.md` docked separator scenario; `tasks.md` 4.10 / 4.17; `assets/cli-shell-product-reference-v8-dialogue-right-grid.png`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.svg`; `assets/cli-shell-product-reference-v8-dialogue-right-grid.txt` | Satisfied |
| Dialogue short time and date divider rendering are specified | `design.md` Decision 9; `specs/cli-shell-product/spec.md` time/date scenarios; `tasks.md` 4.18 / 4.19 | Satisfied |
| Terminal input ownership and geometry are specified | `design.md` Decisions 8 / 10; `specs/cli-shell-product/spec.md` input and geometry requirements; `tasks.md` 4.13-4.15 | Satisfied |
| Detach/reconnect behavior is specified | `design.md` Decision 11; `specs/cli-shell-product/spec.md` detach requirement | Satisfied |
| Validation plan covers targeted tests and real local walkthrough | `tasks.md` Validation section | Satisfied |
| OpenSpec schema accepts the change | `openspec validate add-cli-shell-product --strict` | Satisfied |
| OpenSpec artifact manifest is complete | `openspec status --change add-cli-shell-product --json` reports `isComplete: true` | Satisfied |
| User expectation is confirmed for the current visual target | Latest feedback asks not to retain v7 and to produce v8 as both design image and SVG/TXT auxiliary references; final artifact set keeps only v8 visual references and records terminal-grid understanding in OpenSpec text/grid files | Satisfied |

Completion verdict:

- The OpenSpec artifact set is internally complete and valid.
- The thread goal is objectively complete; final OpenSpec validation remains green after the v8-only reference cleanup.
