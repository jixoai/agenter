# Runtime toolbox

The runtime may expose helper scripts under `~/tools`, but the current baseline can also ship none.

Use them when:

- the shell lacks a common utility you would otherwise have to guess
- you need a stable runtime-owned helper instead of probing random OS binaries
- the helper is truly incidental and does not replace the application's own file or protocol implementation

Do not use helpers to skip core work:

- if the task requires `server.js`, write `server.js`
- if the task requires a concrete HTTP contract, implement that contract in workspace code
- if the task requires a long-lived process, the process still belongs in `terminal`

Discovery flow:

1. `root_workspace_list`
2. inspect `rootWorkspace.toolNames`
3. if helper files exist, `root_workspace_bash` with `ls ~/tools`
4. if a helper is relevant, `root_workspace_bash` with `tool <file> --help`

Rules:

- helper discovery belongs to runtime/workspace, not to a specific business prompt
- if `rootWorkspace.toolNames` is empty, stay with shell / terminal / workspace primitives
- if a helper launches a long-lived process, run it inside `terminal`
- prefer helper `--help` over trial-and-error argument guessing
- if the helper payload is JSON and you are launching it through `terminal write`, prefer JSON stdin for `terminal write` when the nested quoting gets heavy
