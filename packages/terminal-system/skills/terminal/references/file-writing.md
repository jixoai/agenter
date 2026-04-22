# File writing through terminal input

When you need to send a large multi-line command or a whole-file rewrite through terminal input:

- if `terminal write --help` or `terminal input --help` gave you the field names but not the quoting strategy, this file is the next stop
- if you reached this file through `skill info agenter-terminal`, stay in this file unless you specifically need lifecycle or recovery guidance
- prefer one complete command block
- choose `terminal write` when raw bytes are enough; choose `terminal input` when you need mixed DSL
- through `root_bash`, default to `command=terminal write` or `command=terminal input` plus JSON `stdin`
- only use argv JSON when the payload is trivially short
- if `terminal write --help` or `terminal input --help` marks compact as `Suggested` or `Available`, the compact form is still only for short positional payloads; once the text grows or quoting gets heavy, switch back to object JSON immediately
- avoid fragmented line-by-line paste when a single rewrite is possible

Patterns:

```text
root_bash.command: terminal write
root_bash.stdin: {"terminalId":"term-1","text":"cat <<'FILE' > public/index.html\n...\nFILE\r"}
```

When the terminal command itself contains nested JSON, keep both layers JSON-safe by using stdin:

```text
root_bash.command: terminal write
root_bash.stdin: {"terminalId":"term-1","text":"cat <<'JSON' > request.json\n{\"root\":\"/absolute/project/path\",\"mode\":\"rw\"}\nJSON\r"}
```

When you need semantic Enter or waits, switch to mixed mode and keep the literal block inside `<raw>`:

```text
root_bash.command: terminal input
root_bash.stdin: {"terminalId":"term-1","text":"<raw>cat <<'FILE' > public/index.html\n...\nFILE</raw><key data=\"enter\"/>"}
```

After writing, inspect the resulting file or process state instead of assuming the input landed correctly.
