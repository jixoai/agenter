## 1. Unified Heartbeat Ingress

- [x] 1.1 Expand runtime Heartbeat inspection pagination so cold hydration includes legacy `heartbeat` ingress rows alongside `heartbeat_part` and `request_aux`.
- [x] 1.2 Project live legacy ingress rows into the realtime Heartbeat stream without duplicating assistant rows that already have richer structured twins.

## 2. Regression Coverage

- [x] 2.1 Add backend regression coverage for `runtime.heartbeatPartsPage` so it returns unified Heartbeat ingress rows in chronological order.
- [x] 2.2 Add client/runtime regression coverage for live Heartbeat updates when a legacy ingress row is published.
- [x] 2.3 Re-run focused browser/runtime verification so Heartbeat no longer renders an empty state while durable ingress facts already exist.
