# Terminal lifecycle

Use `terminal` when process continuity matters.

Typical flow:

1. `terminal list`
2. Run `terminal create` with JSON `stdin`
3. Decide whether the next payload is raw or mixed
4. Run `terminal write` or `terminal input` with JSON `stdin`
5. Run `terminal read` with JSON `stdin`

Rules:

- recover an existing terminal before creating a second one for the same work
- use `terminal read` after launching a process to inspect its actual state
- keep long-lived or interactive processes in terminals instead of one-shot bash
- anything that binds a port or serves HTTP belongs in a terminal, even if the first attempt is just a quick local experiment
- ad-hoc listener experiments such as `python -m http.server`, custom socket scripts, or temporary `node` servers still count as terminal-owned work
- a promised local URL is only "ready" after the terminal-owned process is actually live and an exact HTTP check for the promised root URL or path succeeds
- `terminal read` output, a running prompt, or "no crash yet" do not replace that HTTP verification; use a separate exact-path check
- if one-shot bash reports binding, sandbox, or permission errors while you are trying to make a URL reachable, treat that as evidence you picked the wrong execution surface
- use `terminal create --help`, `terminal write --help`, `terminal input --help`, and `terminal read --help` for the exact JSON contract
- use `terminal write` for literal raw bytes and encode Enter yourself
- use `terminal input` when you need mixed DSL actions such as `<key .../>`, `<wait .../>`, or `<raw>...</raw>`
- for interactive stdin writers such as `cat > file`, start the program with `terminal write`, then feed the file body and EOF through `terminal input`
- through `root_bash`, keep the command itself minimal and carry terminal JSON in `stdin` by default
- use a single argv JSON payload only when it is trivially short and clearly cheaper in tokens
- if those help surfaces mark compact as `Suggested` or `Available`, the matching command also accepts `--compact` positional arrays; if the array becomes unclear, fall back to standard object JSON
