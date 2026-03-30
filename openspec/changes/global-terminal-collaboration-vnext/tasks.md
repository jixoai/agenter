## 1. Terminal core and global catalog

- [ ] 1.1 Define the split between `terminal-core` PTY mechanics and `terminal-system` collaboration control-plane behavior.
- [ ] 1.2 Move terminal truth, catalog state, and durable collaboration records into the global `.terminal` authority.
- [ ] 1.3 Define global terminal lifecycle APIs that work independently from session startup order.

## 2. Grants, approvals, and write leases

- [ ] 2.1 Define actor-bound terminal grants for `admin`, `writer`, `requester`, and `readonly`.
- [ ] 2.2 Define single-current-admin plus ordered admin-group failover behavior, including pending-request reassignment.
- [ ] 2.3 Define approval request timeout behavior, base write semantics after promotion, and keep it distinct from attention-item lifecycle.
- [ ] 2.4 Define timeboxed write leases and require all write paths to pass through one shared policy gate.

## 3. Runtime projection and transport

- [ ] 3.1 Define terminal-to-session projection facts for activity, focus, and approval subscriptions.
- [ ] 3.2 Update transport and runtime publication contracts for global terminal ids, title/status, and authorized input.
- [ ] 3.3 Define renderer-engine and shared-controller contract updates for terminal-view consumers.

## 4. Terminal surface and verification

- [ ] 4.1 Define the `Terminals` page UI contract for tabs, toolbar, AvatarGroup, badge colors, and border colors.
- [ ] 4.2 Define the multi-writer downgrade prompt and admin/superadmin UX expectations.
- [ ] 4.3 Add backend, runtime, DOM, and browser verification coverage for grants, leases, title/status, and terminal page behavior.
