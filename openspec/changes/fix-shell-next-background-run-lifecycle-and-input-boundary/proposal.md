## Why

Manual acceptance still shows one lifecycle regression and one architecture question:

- `Run in Background` closes the shell-next UI, but the attached terminal does not remain selectable on the next attach.
- We still need a clean self-review of where mouse and keyboard input semantics actually live in shell-next.

The intended product law is already clear:

1. `Run in Background` should exit the shell-next UI without destroying the attached PTY or its product binding.
2. `Terminate terminal` should kill the PTY and close the UI.
3. Terminal-specific input semantics must stay below the app layer.
4. `extensions/cli-shell` stays read-only.

This change exists to turn those statements into explicit behavior instead of letting both close actions drift through the same shutdown path.

## What Changes

- Remove the old shell-next background-run lifecycle branch; background-run is just UI attach-client close.
- Preserve the attached terminal binding when the user chooses `Run in Background`.
- Keep terminal termination destructive only on the `Terminate terminal` path.
- Ensure product command launch uses a managed daemon authority that is not stopped when the foreground product process exits.
- Re-run the input ownership audit and keep terminal-specific mouse/keyboard semantics inside the terminal source/backend boundary.
- Keep shell-next app/view code as product-global routing, raw event forwarding, and visual projection only.
- Add BDD coverage for the lifecycle split and the boundary audit.

## Original Product Intent

These user statements are the source of truth for this change:

1. `Run in Background只意味着关闭当前的界面，退出agenter shell这个进程；结束终端意味着kill底层的PTY，整个界面也都关闭`
2. `你确定已经把所有的input（mouse、keyboard）的处理，全部迁移到内核了？还是仍然存在散落各处的问题？`
3. `全部沉淀完成，再找我review，否则我提出的反馈只会让你在现有基础上打补丁，不能真正解决问题。`

## Non-Goals

- Do not modify `extensions/cli-shell`.
- Do not introduce a new shared OpenCompose terminal kernel package.
- Do not change unrelated button, resize, or selection behavior unless it is part of the lifecycle or input-boundary fix.

## Impact

- Affects `packages/cli` product daemon bootstrap and `extensions/shell-next` attach-client close-confirm flow.
- May touch `packages/client-sdk` or app-server lifecycle plumbing only if a real transport close is proven to stop daemon-owned resources.
- Adds a focused regression story for the next OpenSpec pass.
