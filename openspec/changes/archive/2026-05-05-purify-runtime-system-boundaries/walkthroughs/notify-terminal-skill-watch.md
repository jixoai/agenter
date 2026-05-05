## Scenario

- 10.7 Given muted/background notify flows, quota queries return effective config, eligibility, and history
- 10.8 Given terminal idle/focus changes, runtime keeps lifecycle coordination as scheduler signal instead of task text
- 10.9 Given skill edits and restart/next-round collection, runtime refreshes the skill index and publishes ordinary objective reminders
- 10.10 Given follow-up/watch expiry, runtime creates re-decision attention without automatic room mutation
- 10.11 Walkthrough evidence is written into this directory

## Commands

- `bun test packages/app-server/test/session-runtime.attention-system.test.ts --test-name-pattern "muted notification already crossed the injection boundary|background notification already crossed the injection boundary|background terminal becomes ready|watched skill file changes before the next round|skill changes while the runtime is stopped|root bash mutates a runtime skill|sent acknowledgement arms follow-up reminder|newer visible room message lands before reminder expiry"`

## Expected

- Notify quota is queryable and blocks repeated muted/background notifications inside the configured rolling window.
- Terminal idle/focus lifecycle remains scheduler-only and does not become task text.
- Skill refresh updates queryable skill truth and ordinary reminder publication without dedicated skill task contexts.
- Watch/follow-up expiry reopens model attention only; it never sends a room message automatically.

## Actual

- Muted/background notify tests return blocked state, effective config, remaining eligibility, and send history after a prior successful injection boundary.
- Terminal idle-ready test records scheduler wake truth without committing a `ready for your input` task fact.
- Skill watcher tests flush one aggregated reminder at the next round, refresh stopped-session projection on restart, and surface added/updated/removed skill reminders through ordinary attention input.
- Follow-up reminder tests create attention on due expiry and suppress stale reminders after newer visible room activity, without auto-sending another room message.

## Evidence

- Notify quota:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2314)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2404)
- Terminal scheduler-only lifecycle:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2022)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:2198)
- Skill refresh / restart:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4935)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4987)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:5064)
- Watch / follow-up:
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4586)
  - [session-runtime.attention-system.test.ts](/Users/kzf/Dev/GitHub/jixoai-labs/agenter/packages/app-server/test/session-runtime.attention-system.test.ts:4654)

## Verdict

- pass
- Notify, terminal lifecycle, skill refresh, and follow-up reminders now all obey the shared boundary law instead of injecting source-specific hidden obligations or side effects.
