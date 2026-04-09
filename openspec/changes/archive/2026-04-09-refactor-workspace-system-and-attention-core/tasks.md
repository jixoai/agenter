## 1. Runtime and storage law replacement

- [x] 1.1 Replace `workspace + avatar` runtime identity with canonical AvatarRuntime identity and update durable runtime/session metadata to match
- [x] 1.2 Introduce WorkspaceSystem domain models for mounts, grants, public assets, avatar-private assets, and workspace exec profiles
- [x] 1.3 Replace the old singular avatar/workspace disk layout with the new plural `avatars` and workspace public/private roots, without backward compatibility

## 2. Attention and adapter refactor

- [x] 2.1 Extend `AttentionContext` durability and APIs with focus state plus `commit` vs `push` ingress semantics
- [x] 2.2 Replace standalone notification truth with attention-derived notification projections and runtime publication
- [x] 2.3 Rewire MessageSystem and TerminalSystem hooks to consume one-way attention focus and derived availability state

## 3. Workspace execution and asset surfaces

- [x] 3.1 Add sandboxed workspace bash execution backed by `just-bash` with path-level grant enforcement
- [x] 3.2 Expose workspace public/private `skills`, `memory`, `tools`, and `archive` roots through WorkspaceSystem APIs and runtime tools
- [x] 3.3 Move avatar seat credentials and related workspace-local asset reads/writes to the new plural avatar-private paths

## 4. Backend API and verification surfaces

- [x] 4.1 Replace tRPC and client-sdk workspace/avatar/runtime contracts with WorkspaceSystem and AvatarRuntime shapes
- [x] 4.2 Add a minimal backend verification CLI or script that exercises runtime/workspace/attention contracts without WebUI
- [x] 4.3 Write `.chat` backend interface notes for the future frontend integration, including reactive consumption caveats

## 5. Verification and durable law sync

- [x] 5.1 Add integration tests for multi-workspace mounts, RO/RW grants, workspace bash sandboxing, and attention push routing
- [x] 5.2 Self-walk the backend harness and, if any backend defect is discovered, resolve it in an independent change before final sign-off
- [x] 5.3 Update durable `SPEC.md` and affected package-level specs for the new backend laws once implementation is complete
