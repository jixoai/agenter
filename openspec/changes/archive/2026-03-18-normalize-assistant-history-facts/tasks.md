## 1. Runtime refactor

- [x] 1.1 Extract a single assistant-fact sequence builder in `packages/app-server/src/agenter-ai.ts`
- [x] 1.2 Reuse that fact sequence for both chat message output and assistant history replay without synthetic headings

## 2. Contract cleanup

- [x] 2.1 Remove obsolete assistant-history runtime text keys from i18n core and language packs
- [x] 2.2 Update `packages/app-server/test/agenter-ai.test.ts` to assert factual replay, ordering, and raw tool fences

## 3. Verification

- [x] 3.1 Run targeted app-server tests covering assistant history replay
