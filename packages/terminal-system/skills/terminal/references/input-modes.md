# Terminal input modes

Use this note when you need to decide between `terminal write` and `terminal input`.

Rules:

- `terminal write` is raw mode.
- `terminal input` is mixed mode.
- Raw mode sends literal bytes exactly as provided.
- Mixed mode parses terminal actions such as `<key .../>` and `<wait .../>`.
- If you need literal `<...>` text inside mixed mode, wrap that region in `<raw>...</raw>`.
- If a whole literal line contains `<key .../>` or another tag-like snippet, keep that whole literal line inside the same `<raw>...</raw>` block.
- `<raw>...</raw>` only decodes fixed HTML entities: `&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`.
- A missing `</raw>` is a hard parse error.
- Nested `<raw>` is also a hard parse error. If you need literal `<raw>` text, encode it as `&lt;raw&gt;`.
- Ctrl combos use `ctrl="true"` with the plain key data. For example, EOF is `<key data="d" ctrl="true"/>`, not `data="C-d"`.

Choose raw mode when:

- you already know the exact bytes to send
- you want explicit `\r`, `\n`, or control characters
- you are pasting a full command string and can encode Enter yourself

Choose mixed mode when:

- you need semantic key presses such as Enter, Tab, Arrow keys, or Ctrl combos
- you need explicit waits between actions
- you need a single payload that mixes literal text with key presses

Examples:

```text
root_bash.command: terminal write
root_bash.stdin: {"terminalId":"term-1","text":"npm run dev\\r"}
```

```text
root_bash.command: terminal input
root_bash.stdin: {"terminalId":"term-1","text":"<raw>npm run dev</raw><key data=\"enter\"/>"}
```

```text
root_bash.command: terminal input
root_bash.stdin: {"terminalId":"term-1","text":"<raw>echo &lt;key&gt;literal&lt;/key&gt;</raw><key data=\"enter\"/>"}
```

```text
root_bash.command: terminal input
root_bash.stdin: {"terminalId":"term-1","text":"<raw><key data=\"enter\"/>\ndone\n</raw><key data=\"d\" ctrl=\"true\"/>"}
```
