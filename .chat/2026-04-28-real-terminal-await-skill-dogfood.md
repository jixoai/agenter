# Real AI Dogfood: terminal await learned from skill

Date: 2026-04-28

## Goal

Verify that a real AI can learn `terminal await` from `agenter-terminal` skill guidance and use it for delayed terminal output, without being directly prompted to use `await`.

## Prompt Boundary

The scenario prompt requires the assistant to run `skill info agenter-terminal` first, then complete a delayed terminal-output task. It does not mention `terminal await`, `timeout`, `grep`, `sleep`, or any prohibition against polling.

The test assertions, not the prompt, enforce the behavior:

- `skill info agenter-terminal` appears before `terminal await`
- `terminal await` appears in `root_bash` commands
- `timeout ... terminal` does not appear
- `terminal read | grep` does not appear
- `sleep && terminal read` / `sleep ; terminal read` does not appear

## Evidence

Command:

```bash
AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-terminal-skill.integration.test.ts -t "terminal output is delayed" --timeout 420000
```

Result:

```txt
pass Feature: real AI terminal skill learning > Scenario: Given a real provider When terminal output is delayed Then the assistant uses terminal await instead of timeout grep polling
1 pass, 0 fail
```

Duration: about 66 seconds.

## Conclusion

The real-provider run confirms the assistant can discover `terminal await` through the terminal skill and use it as the bounded observation primitive for delayed terminal evidence, without task-level prompt forcing.
