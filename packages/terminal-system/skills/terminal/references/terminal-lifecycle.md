# Terminal lifecycle

Use `terminal` when process continuity matters.

Typical flow:

1. `terminal list`
2. `terminal create '{"cwd":"...","focus":true}'`
3. `terminal write '{...}'`
4. `terminal read '{"terminalId":"..."}'`

Rules:

- recover an existing terminal before creating a second one for the same work
- use `terminal read` after launching a process to inspect its actual state
- keep long-lived or interactive processes in terminals instead of one-shot bash
- anything that binds a port or serves HTTP belongs in a terminal, even if the first attempt is just a quick local experiment
- ad-hoc listener experiments such as `python -m http.server`, custom socket scripts, or temporary `node` servers still count as terminal-owned work
- a promised local URL is only "ready" after the terminal-owned process is actually live and an exact HTTP check for the promised root URL or path succeeds
- `terminal read` output, a running prompt, or "no crash yet" do not replace that HTTP verification; use a separate exact-path check
- if one-shot bash reports binding, sandbox, or permission errors while you are trying to make a URL reachable, treat that as evidence you picked the wrong execution surface
- use `terminal create --help`, `terminal write --help`, and `terminal read --help` for the exact JSON contract
- prefer `terminal create '{"cwd":"/absolute/project/path","focus":true}'` over ad-hoc positional guesses
- when `terminal write.text` needs nested JSON or heavy quoting, switch to JSON stdin for `terminal write`
