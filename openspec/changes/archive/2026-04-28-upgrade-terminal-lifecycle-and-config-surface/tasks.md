## 1. OpenSpec Truth

- [x] 1.1 Add delta specs for terminal control-plane, runtime terminal contract, runtime JSON descriptors, and runtime skills so lifecycle transitions plus config surfaces are explicitly testable.
- [x] 1.2 Document the durable-vs-transient law: `processPhase` stays durable, `lifecycleTransition` stays coordination-only, and transition changes do not create terminal Attention commits by themselves.

## 2. Terminal Kernel

- [x] 2.1 Extend terminal-system runtime truth and projections with `lifecycleTransition`.
- [x] 2.2 Add transition-safe lifecycle mutation handling so concurrent bootstrap/stop/delete requests cannot overlap on the same terminal.
- [x] 2.3 Add control-plane `getConfig` / `setConfig` APIs for durable terminal launch/config truth.
- [x] 2.4 Add managed-terminal reconfiguration so updated durable config is used on later bootstrap, with live geometry apply for running PTYs.

## 3. Runtime CLI / Help / Skill

- [x] 3.1 Add descriptor-backed `terminal get-config` and `terminal set-config` routes, schemas, help text, and runtime-local handler wiring.
- [x] 3.2 Update built-in terminal skill and references so AI learns create auto-bootstrap, stopped-terminal explicit bootstrap, transition wait rules, and config inspection/mutation commands.

## 4. Verification

- [x] 4.1 Add targeted BDD coverage for terminal-system lifecycle transitions and config mutation behavior.
- [x] 4.2 Add targeted BDD coverage for runtime terminal adapter / CLI / skill guidance around transition truth and `get-config` / `set-config`.
- [x] 4.3 Run targeted test suites plus OpenSpec validation for this change.
