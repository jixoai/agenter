# File writing through terminal input

When you need to send a large multi-line command or a whole-file rewrite through terminal input:

- prefer one complete command block
- through `root_workspace_bash`, default to `command=terminal write` plus JSON `stdin`
- only use argv JSON for `terminal write` when the payload is trivially short
- if `terminal write --help` marks compact as `Suggested` or `Available`, `terminal write --compact` is still only for short positional payloads; once the text grows or quoting gets heavy, switch back to object JSON immediately
- avoid fragmented line-by-line paste when a single rewrite is possible

Patterns:

```text
root_workspace_bash.command: terminal write
root_workspace_bash.stdin: {"terminalId":"term-1","text":"cat <<'FILE' > public/index.html\n...\nFILE","submit":true}
```

When the terminal command itself contains nested JSON, keep both layers JSON-safe by using stdin for `terminal write`:

```text
root_workspace_bash.command: terminal write
root_workspace_bash.stdin: {"terminalId":"term-1","text":"cat <<'JSON' > request.json\n{\"root\":\"/absolute/project/path\",\"mode\":\"rw\"}\nJSON","submit":true}
```

After writing, inspect the resulting file or process state instead of assuming the input landed correctly.
