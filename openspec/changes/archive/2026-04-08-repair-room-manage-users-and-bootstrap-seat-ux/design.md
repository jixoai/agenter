## Context

The current room-management dialog is structurally close to the intended design, but its projection rules are still wrong. A system bootstrap token is being treated as if it were a human or avatar room user. That breaks the user's mental model because room membership, room grants, and control-plane ownership are separate facts.

## Goals / Non-Goals

**Goals**

- Keep internal control seats available for control-plane operations without rendering them as normal room members
- Make `Users` and `Permissions` read like one coherent management workflow with clear single-responsibility boundaries
- Remove repeated room-manage metadata unless the user explicitly asked for it
- Reassert explicit `ScrollView` ownership for any stretchable list or detail region

**Non-Goals**

- Change room authorization semantics in the backend
- Remove internal bootstrap control from the control plane
- Introduce a new room-management information architecture beyond `Overview / Users / Permissions`

## Decisions

### Internal bootstrap seats stay in the control plane, not the user plane

`system:trusted-bootstrap` remains a valid internal control seat for room creation, admin mutations, and compatibility with existing room ownership facts. However, user-facing projections such as `Users`, `View as`, and ordinary `Send as` choices must filter system actors out unless the surface is explicitly describing control-plane metadata.

### Users and Permissions split membership from authority

The `Users` section owns seat listing, add-user, focus, and revoke flows. The `Permissions` section owns inline role changes for existing seats. This keeps add/remove operations and permission mutation separate without forcing the operator to hunt through unrelated metadata.

### Stretchable room-manage shells must keep one scroll owner

Room-management dialog rails and stage bodies must express a single `ScrollView` owner for each stretchable region. Cards and wrappers remain semantic surfaces only; they do not silently take over scroll behavior.

### Room-manage surfaces should show actions, not vanity metadata

Summary/stat cards and duplicate room metadata are removed from room-management unless they are part of the user's explicit requirement. The primary surface should lead with the actionable list, role editor, or lifecycle control that the operator came to use.

## Risks / Trade-offs

- [Risk] Filtering system seats out of viewer/send-as lists could hide an internal debugging path. -> Mitigation: preserve the control seat only in room/control metadata, not in user-facing selectors.
- [Risk] Removing repeated metadata reduces at-a-glance counts. -> Mitigation: keep counts as quiet inline metadata inside the relevant headers or badges when truly needed.
- [Risk] Scroll-owner refactors can regress compact dialog shells. -> Mitigation: verify desktop and compact room-manage paths with targeted review.
