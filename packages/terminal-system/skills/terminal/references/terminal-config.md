# Terminal config

Use `terminal get-config` and `terminal set-config` when the durable terminal identity is correct but the launch truth needs inspection or adjustment.

Typical flow:

1. Run `terminal list`
2. If the terminal already exists, run `terminal get-config`
3. If `lifecycleTransition` is `bootstrapping` or `killing`, wait and reread before mutating config
4. Run `terminal set-config` with JSON `stdin`
5. If you changed launch-affecting fields for a running PTY, stop/bootstrap later to pick up the new durable truth

Rules:

- `terminal list` is still the lifecycle and observed-identity surface; `terminal get-config` is the durable launch/config surface
- `terminal get-config` returns durable fields such as `command`, `launchCwd`, `processKind`, profile fields, metadata, plus minimal lifecycle summary
- do not infer durable config from `currentPath` or `currentTitle`; those are observed runtime facts, not launch truth
- `terminal set-config` uses patch semantics; send only the fields you intend to change
- `cols` and `rows` may resize a running PTY immediately while also updating durable config
- `command`, `launchCwd`, `env`, `processKind`, `gitLog`, and `logStyle` update durable truth first and normally take effect on the next bootstrap
- `title`, `icon`, `shortcuts`, `rendererEngine`, and `metadata` update the durable projection without rewriting the running shell process in place
- if the next mutation is unclear, read `terminal get-config --help` or `terminal set-config --help` before guessing payload shape
- through `root_bash`, keep the command minimal and carry config JSON in `stdin` by default
