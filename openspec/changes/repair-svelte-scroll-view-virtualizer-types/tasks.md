## 1. ScrollView Type Contract Repair

- [ ] 1.1 Align `scroll-view.types.ts` with the installed `@tanstack/svelte-virtual` exports
- [ ] 1.2 Repair `scroll-view.svelte` virtual row and `measureElement` typing without changing runtime behavior
- [ ] 1.3 Run Svelte autofixer on the modified shared component and keep only valid output

## 2. Validation

- [ ] 2.1 Run `pnpm --filter @agenter/svelte-components typecheck`
- [ ] 2.2 Run `pnpm --filter @agenter/webui typecheck`
- [ ] 2.3 Validate the OpenSpec change
