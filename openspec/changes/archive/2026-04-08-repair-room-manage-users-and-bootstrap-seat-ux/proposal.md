## Why

The current follow-up Svelte WebUI still leaks internal control facts into user-facing room administration and still violates the room-manage information-density rules.

- `Messages` room management still shows `system:trusted-bootstrap` as if it were a normal room user, which creates a false duplicate between the internal bootstrap control seat and the authenticated superadmin.
- The `Users` section does not expose a coherent membership workflow, so adding a user, removing a user, and changing a user's permission are split across noisy or misleading surfaces.
- The room-management dialog still contains repeated or low-value metadata that dilutes the main task.
- Some dialog header and stretchable regions still lack a clean `ScrollView` owner, which causes overlap and unstable overflow behavior.

These are not isolated cosmetic issues. They are projection and shell-composition violations that confuse authority modeling and weaken the operator workflow.

## What Changes

- Re-project message-system room seats so internal bootstrap control seats stop appearing as normal room users or normal send-as/viewer actors.
- Refine the room-management dialog so `Users` owns membership listing plus add/remove flows, `Permissions` owns per-user role changes, and the dialog header/body keep one clear layout owner and one clear scroll owner.
- Remove unsolicited stat/summary surfaces from room-management, keeping the dialog focused on the primary operator task.
- Tighten regression coverage around room management and its management-shell navigation flow.

## Capabilities

### Modified Capabilities

- `message-system-surface`

## Impact

- `packages/webui/src/lib/features/messages`
- `openspec/specs/message-system-surface`
