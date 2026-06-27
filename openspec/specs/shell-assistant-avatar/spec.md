# shell-assistant-avatar Specification

## Purpose
Define the default `shell-assistant` Avatar contract for cli-shell, including prompt seeding, NoteSystem recording, managed-mode continuity, self-evolution behavior, and real-AI semantic evaluation.

## Requirements

### Requirement: Cli-shell SHALL initialize shell-assistant as a dedicated terminal assistant Avatar

When cli-shell is launched without an explicit `@avatar` mention, it SHALL ensure an Avatar with nickname `shell-assistant`. The ensure flow SHALL seed a missing `AGENTER.mdx` prompt source for terminal pair programming while leaving existing prompt and legacy user assets openly editable. New recording behavior SHALL use NoteSystem through projected `note` CLI capability rather than initializing a dedicated memory-file pack as the default recording surface.

#### Scenario: Missing shell-assistant gets prompt defaults and note guidance
- **GIVEN** no Avatar with nickname `shell-assistant` exists
- **WHEN** a user runs `agenter shell`
- **THEN** cli-shell ensures the `shell-assistant` Avatar through generic Avatar/app-extension APIs
- **AND** it initializes missing `AGENTER.mdx` prompt source for that Avatar
- **AND** the prompt teaches NoteSystem recording through projected `note` CLI
- **AND** core launcher modules do not special-case that Avatar nickname

#### Scenario: Existing shell-assistant resources remain open user truth
- **GIVEN** Avatar `shell-assistant` already has user-edited `AGENTER.mdx` or memory files
- **WHEN** cli-shell runs its ensure flow
- **THEN** it reads the existing prompt as current prompt truth
- **AND** it does not lock, hide, delete, migrate, or automatically rewrite legacy memory files
- **AND** advanced users may continue editing those low-level files manually

#### Scenario: Explicit Avatar bypasses shell-assistant defaults
- **WHEN** a user runs `agenter shell @default`
- **THEN** cli-shell selects Avatar `default`
- **AND** it does not initialize or mutate `shell-assistant` prompt, note, or legacy memory assets as part of that explicit override

### Requirement: Shell-assistant AGENTER.mdx SHALL describe flexible pair programming and self-evolution

The default `shell-assistant` `AGENTER.mdx` SHALL bias the Avatar toward understanding the user and evolving fit over time. It SHALL avoid hard-coding one collaboration style, user seniority, model behavior, or managed-mode completion recipe. Self-evolution SHALL be orthogonal to managed mode, and raw recording SHALL use NoteSystem rather than dedicated memory files.

#### Scenario: Non-managed mode is learning-oriented pair programming
- **WHEN** `shell-assistant` is active and managed mode is off
- **THEN** its prompt guidance emphasizes observing the user's terminal habits, preferences, corrections, constraints, and thinking style
- **AND** it treats pair programming as an adaptive relationship rather than a fixed workflow
- **AND** it asks, explains, or acts according to the learned user fit and current evidence

#### Scenario: Managed mode is autonomous but not scripted
- **WHEN** managed mode is on
- **THEN** `AGENTER.mdx` guides the Avatar to take independent responsibility for the active hosting objective
- **AND** it does not hard-code a universal rule for when takeover is complete
- **AND** it tells the Avatar to decide whether to continue watching, report to chat, operate the terminal, ask for approval, record a note, or settle the obligation based on prompt, note history, user intent, and current evidence

#### Scenario: Prompt avoids fixed user archetypes
- **WHEN** the default prompt describes possible user relationships
- **THEN** it allows users to be highly directive, exploratory, novice, senior, playful, or otherwise idiosyncratic
- **AND** it instructs the Avatar to learn the actual user instead of assuming a preset archetype

#### Scenario: Senior-led collaboration is learned from evidence
- **WHEN** a senior engineer primarily leads the terminal work and uses `shell-assistant` for review, explanation, or bounded operation
- **THEN** the assistant is guided to keep the user in control unless evidence or hosting attention asks for more autonomy
- **AND** it may record durable collaboration evidence as notes under appropriate notebooks or draft notes
- **AND** it does not treat senior-led behavior as a universal default for all users

#### Scenario: Requirement-led collaboration is learned from evidence
- **WHEN** a user mainly states needs and expects the assistant to drive more planning, implementation, and explanation
- **THEN** the assistant is guided to take more initiative within app and TerminalSystem authority boundaries
- **AND** it may record learned autonomy level and explanation needs as notes
- **AND** it does not hard-code the user as novice or remove opportunities for the user to lead later

#### Scenario: Playful collaboration preserves engineering boundaries
- **WHEN** a user interacts with `shell-assistant` in a playful or companion-like style
- **THEN** the assistant may adapt tone and cadence to the learned relationship
- **AND** it still preserves terminal truth ownership, prompt/note discipline, TerminalSystem authority requirements, and durable engineering constraints
- **AND** it records only operationally useful preferences rather than treating playfulness as a app mode

#### Scenario: Self-evolution can run without managed mode through programmable attention
- **WHEN** the user asks `shell-assistant` to compose a self-evolution loop such as a nightly reflection
- **AND** managed mode is off
- **THEN** `AGENTER.mdx` still guides the Avatar to use notes, skills, and minimal attention-cli compatible `commit/query/settle` operations to review recent work, record useful evidence, and improve skills when appropriate
- **AND** it does not require a hosting AttentionItem or terminal takeover lease to evolve itself
- **AND** dedicated watch or schedule primitives are deferred to `extend-attention-cli-self-evolution-runtime`
- **AND** example names such as `auto-dream` are not treated as built-in core features, fixed score keys, or mandatory app commands

### Requirement: Shell-assistant SHALL use NoteSystem recording guidance from AGENTER.mdx

Shell-assistant SHALL use NoteSystem as the default durable raw-recording surface for terminal pair programming, self-evolution, and managed-mode continuity. `AGENTER.mdx` SHALL name the `note` CLI and the NoteSystem skill, and SHALL instruct the Avatar when to draft, list, search, show, append, or override notes so context compaction does not erase useful evidence. Note guidance SHALL teach the mandatory `mime` field and the mutually exclusive `content` / `contentFile` input law.

#### Scenario: Default recording surface is NoteSystem
- **WHEN** cli-shell initializes missing shell-assistant prompt resources
- **THEN** `AGENTER.mdx` teaches `note draft`, `note write`, `note list`, `note show`, and `note search`
- **AND** it does not list `user-model.md`, `pairing-playbook.md`, `terminal-habits.md`, `self-evolution-log.md`, or `hosting-objective.md` as the default recording pack

#### Scenario: User fit notes are recorded from durable corrections
- **WHEN** the user gives a durable preference, correction, instruction, or repeated working pattern
- **THEN** `shell-assistant` is guided to record raw evidence through NoteSystem when the evidence justifies persistence
- **AND** it avoids dumping raw transcript into prompt text or pretending the note is already distilled memory

#### Scenario: Hosting objective notes are refreshed on managed enable
- **WHEN** the user enables managed mode
- **THEN** `shell-assistant` is guided to record the active objective, resources, watch policy, progress, open risks, and known stop conditions through NoteSystem if continuity evidence is needed
- **AND** this note history lets a later compacted context recover the hosting obligation through `note search` or `note show`

#### Scenario: Self-evolution notes are not tied to hosting objective notes
- **WHEN** `shell-assistant` updates user preferences, learned habits, skill gaps, or scheduled reflection outcomes
- **THEN** it records those facts as ordinary NoteSystem notes
- **AND** it does not require or mutate hosting-specific notes unless the update is about an active hosting obligation

### Requirement: Shell-assistant self-evolution SHALL be evaluated by real AI judge scenarios

Shell-assistant self-evolution behavior SHALL have long-running real AI semantic evaluation coverage because deterministic tests cannot fully judge whether the assistant learned the correct user fit or evolved in the correct direction. The evaluation SHALL use the existing semantic judge infrastructure, model-response cache where available, and a structured scoring rubric. The rubric SHALL treat NoteSystem records as raw evidence and SHALL NOT require legacy memory-file diffs as the primary proof.

#### Scenario: AI judge scores self-evolution quality
- **WHEN** a real shell-assistant self-evolution scenario finishes
- **THEN** the test submits the scenario trace, relevant note evidence, prompt guidance, and app facts to a semantic judge such as `SemanticJudge.judgeStructured`
- **AND** the judge returns a numeric score using an explicit rubric
- **AND** the rubric covers user-fit learning, note quality, self-evolution direction, orthogonality, hosting separation, programmable attention usage, and anti-overfit behavior

#### Scenario: Low AI judge score retries before failing
- **WHEN** the semantic judge score is below the configured threshold
- **THEN** the evaluation may retry the scenario to account for model variance
- **AND** the default policy allows at most two retries after the first failed score
- **AND** if all attempts remain below threshold, the test fails as a app issue requiring prompt adjustment or bug repair

#### Scenario: AI evaluation covers multiple collaboration styles
- **WHEN** real AI evaluation scenarios are defined
- **THEN** they include at least senior-led, requirement-led, and playful collaboration traces
- **AND** the expected outcome is adaptive learning from evidence rather than matching a fixed archetype label
- **AND** the assistant is judged on whether the resulting notes and future behavior remain useful across those styles

#### Scenario: Long-running scripts validate learned behavior across time
- **WHEN** validating prompt usefulness and self-evolution direction
- **THEN** the test suite includes long-running real AI scripts that simulate many turns of terminal use, corrections, note updates, context compaction or restart, and later behavior
- **AND** cached model responses may be used to reduce repeated local cost
- **AND** normal CI may skip or gate the suite, but release or app acceptance uses it as the meaningful prompt validation path

### Requirement: Shell-assistant prompt evolution SHALL NOT overfit AI evaluation fixtures

Prompt and recording guidance changes made to improve shell-assistant evaluation SHALL preserve the orthogonal design laws in this change. Passing a narrow test fixture SHALL NOT justify app/core coupling, hidden hosting behavior, fixed user archetypes, or named self-evolution kernel features.

#### Scenario: Prompt fix preserves orthogonal design law
- **WHEN** a shell-assistant evaluation fails and developers adjust `AGENTER.mdx`
- **THEN** the adjustment improves the general pair-programming, self-evolution, recording, and attention laws
- **AND** it does not add fixture-specific phrases, fixed collaboration archetypes, core `auto-dream` behavior, or hidden terminal takeover rules solely to pass that test

#### Scenario: Development contradiction is recorded instead of hidden
- **WHEN** a prompt, implementation, or test rubric change would pass a specific evaluation while weakening this change's orthogonal design
- **THEN** the contradiction is recorded under `.chat/add-cli-shell-app/` with the evidence, observed pain point, and suspected idealized assumption
- **AND** the OpenSpec law, implementation, or evaluation rubric is revised explicitly rather than hiding the conflict in test-specific prompt wording

### Requirement: Managed mode SHALL create a hosting AttentionItem instead of hard-coded takeover workflow

Cli-shell managed mode SHALL create or refresh a app-scoped AttentionItem for the selected Avatar. The AttentionItem SHALL use the literal fixed score key `scores: {"hosting": 1000}`. The score represents unresolved hosting obligation. Cli-shell SHALL force `hosting` to `0` when the user disables managed mode; the Avatar may also lower it to `0` after it decides the obligation is actually settled.

#### Scenario: Managed on commits hosting attention
- **WHEN** the user enables managed mode from cli-shell
- **THEN** cli-shell commits an AttentionItem for the selected Avatar with `scores: {"hosting": 1000}`
- **AND** the item content identifies the app, shell name, terminal id, room id, granting user, and current user-visible objective if known
- **AND** the attention item is the scheduling fact, not a local toolbar boolean

#### Scenario: Managed off forces hosting settlement
- **GIVEN** cli-shell managed mode previously committed a positive `hosting` score
- **WHEN** the user disables managed mode from cli-shell
- **THEN** cli-shell commits an attention update with `scores: {"hosting": 0}`
- **AND** the update records reason `user_disabled`
- **AND** the update does not revoke unrelated TerminalSystem grants, guard approval requests, or write leases

#### Scenario: Open-ended watch task can remain unresolved
- **GIVEN** the user asked the assistant to watch the terminal and report problems to chat
- **WHEN** the Avatar determines the work is intentionally open-ended
- **THEN** it may keep the `hosting` score positive
- **AND** it records enough progress and watch policy through NoteSystem for continuity after compaction

#### Scenario: Completed managed task settles hosting score
- **GIVEN** managed mode is active for a concrete task
- **WHEN** the Avatar determines the requested work is complete and reports the outcome
- **THEN** it may commit an attention update that lowers `hosting` to `0`
- **AND** it should record completion state through NoteSystem before or alongside settlement when continuity evidence is useful

#### Scenario: Hosting attention does not grant terminal write authority by itself
- **WHEN** a hosting AttentionItem has positive score
- **THEN** it may wake or keep scheduling the Avatar
- **AND** it does not by itself authorize terminal writes
- **AND** terminal writes still require TerminalSystem-native writer authority, guard approval, or an active terminal write lease with Avatar actor provenance

### Requirement: Shell-assistant SHALL keep guard approval terminal-local in cli-shell

The default shell-assistant prompt guidance SHALL keep cli-shell MessageRoom work focused on the bound TerminalSystem terminal. Guard approval, denial, expiry, and timeout SHALL be treated as terminal-local authorization outcomes rather than reasons to perform equivalent bound-terminal work through another execution surface.

#### Scenario: Shell-assistant targets the bound terminal
- **WHEN** shell-assistant handles a cli-shell MessageRoom request to run, type, inspect, or continue terminal work
- **THEN** it treats the bound TerminalSystem terminal as the target
- **AND** if implementation-internal terminals exist, the prompt keeps them out of the default conversation model
- **AND** it does not satisfy that bound-terminal request by running an equivalent command in `root_bash` or `workspace_bash`

#### Scenario: Guard approval remains terminal-local
- **WHEN** shell-assistant receives a guard approval request from TerminalSystem
- **THEN** the prompt guidance treats it as pending work on the bound terminal
- **AND** denial, expiry, or timeout does not authorize the Avatar to perform the same bound-terminal action through another execution surface
