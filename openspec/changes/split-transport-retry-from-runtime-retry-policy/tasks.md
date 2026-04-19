## 1. Schema And Resolution

- [ ] 1.1 Introduce the durable runtime retry-policy schema and separate provider transport retry settings from runtime policy semantics
- [ ] 1.2 Update settings loading and resolved session config so transport retry and runtime retry policy resolve as independent contracts

## 2. Runtime Kernel And Interfaces

- [ ] 2.1 Update containment/backoff logic to consume the resolved runtime retry policy instead of hard-coded retry math
- [ ] 2.2 Update runtime control/publication interfaces to expose the policy-resolved recovery state needed by clients

## 3. WebUI Runtime Settings

- [ ] 3.1 Move durable retry-policy editing into the runtime Settings surface with clear section ownership
- [ ] 3.2 Keep Heartbeat quick config execution-scoped and remove durable retry-policy editing from that path

## 4. Verification And Migration

- [ ] 4.1 Add or update focused tests for schema migration, resolved config, runtime containment, and runtime Settings behavior
- [ ] 4.2 Run targeted verification for legacy-read/new-write migration and policy-driven recovery flows
