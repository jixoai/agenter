# Verification

## Real Provider Selection

Command:

```bash
bun -e 'import { resolveRealModelConfig } from "./packages/app-server/test-support/real-model-cache.ts"; console.log(JSON.stringify(resolveRealModelConfig(process.cwd()), null, 2));'
```

Observed result on `2026-03-26`:

```json
{
  "apiStandard": "anthropic",
  "baseUrl": "https://api.kimi.com/coding",
  "model": "kimi-for-coding",
  "vendor": "kimi",
  "profile": "compatible"
}
```

This proves the runtime now resolves the user-selected `kimi` provider instead of silently falling back to the checked-in project `default/deepseek`.

## Real Session Story

Manual real-provider run:

```bash
bun /tmp/debug-real-loopbus.ts
```

Scenario:

- create a real kernel harness with the resolved `kimi` provider
- send one user message requiring a minimal attention-first closure
- require the assistant reply to be exactly `REAL-AI-OK`
- require the related attention score to converge to `0`

Observed sequence:

1. Tick 2: `chat-main` receives assistant message `REAL-AI-OK`
2. Tick 5: `activeAttention` becomes empty
3. Tick 7: runtime returns to `waiting_commits`, `runtimeStatus=idle`, `unresolvedScoreCount=0`
4. Tick 7: latest model call reports `status=done`, `outcome.code=done`

This proves a real provider run can now:

- use the intended provider selection
- deliver the reply through the message bridge
- publish the follow-up `attention_commit`
- reduce the score debt to zero
- settle the model call instead of remaining in the old silent-fallback path
