## 1. Contract

- [x] 1.1 Record ordered glob grant law in change artifacts and workspace durable spec

## 2. Implementation

- [x] 2.1 Replace workspace grant persistence with `pattern + mode + ruleIndex`, including snapshot migration from legacy root-path records
- [x] 2.2 Add a shared workspace grant evaluator and reuse it in workspace bash, root workspace bash, terminal cwd validation, workbench tree/preview, and runtime CLI projection
- [x] 2.3 Update tRPC, client-sdk, and webui rule editing flows to speak in glob patterns instead of path-root grants

## 3. Validation

- [x] 3.1 Add regression coverage for ordered glob overrides, default-deny reads, and root workspace shell visibility
- [x] 3.2 Re-run focused app-server, client-sdk, and webui validation for the workspace rule path
