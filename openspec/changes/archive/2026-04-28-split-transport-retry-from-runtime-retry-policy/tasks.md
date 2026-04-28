## 1. Schema And Resolution

- [x] 1.1 Introduce the durable runtime retry-policy and compact-policy schema and separate provider transport retry settings from runtime policy semantics
- [x] 1.2 Update settings loading and resolved session config so transport retry, runtime retry policy, and runtime compact policy resolve as independent contracts

## 2. Runtime Kernel And Interfaces

- [x] 2.1 Update containment/backoff logic and compact-trigger decisions to consume the resolved runtime policies instead of hard-coded retry math or any-error fallback
- [x] 2.2 Update runtime control/publication interfaces to expose the policy-resolved recovery and compact state needed by clients

## 3. WebUI Runtime Settings

- [x] 3.1 Move durable retry-policy and compact-policy editing into the runtime Settings surface with clear section ownership
- [x] 3.2 Keep Heartbeat quick config execution-scoped and remove durable retry-policy editing from that path

## 4. Verification And Migration

- [x] 4.1 Add or update focused tests for schema migration, resolved config, compact triggers, runtime containment, and runtime Settings behavior
- [x] 4.2 Run targeted verification for legacy-read/new-write migration and policy-driven recovery / compact flows
