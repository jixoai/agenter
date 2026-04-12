# File writing through terminal input

When you need to send a large multi-line command or a whole-file rewrite through terminal input:

- prefer one complete command block
- use JSON stdin or JSON argv for `terminal write`
- avoid fragmented line-by-line paste when a single rewrite is possible

Patterns:

```bash
cat <<'EOF' | terminal write
{
  "terminalId": "term-1",
  "text": "cat <<'FILE' > public/index.html\n...\nFILE",
  "submit": true
}
EOF
```

When the terminal command itself contains nested JSON, keep both layers JSON-safe by using stdin for `terminal write`:

```bash
cat <<'EOF' | terminal write
{
  "terminalId": "term-1",
  "text": "cat <<'JSON' > request.json\n{\"root\":\"/absolute/project/path\",\"mode\":\"rw\"}\nJSON",
  "submit": true
}
EOF
```

After writing, inspect the resulting file or process state instead of assuming the input landed correctly.
