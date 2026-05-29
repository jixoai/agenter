## 1. OpenSpec Boundary

- [x] 1.1 Record the original architecture concern: `core` cannot own optional input behavior because complete future backends may conflict with it.
- [x] 1.2 Define `@agenter/termless-backend-utils` as opt-in utility composition, not backend authority.
- [x] 1.3 Define BDD scenarios for feature switches and transaction switches.

## 2. Package Extraction

- [ ] 2.1 Create `packages/termless-backend-utils` package metadata, tsconfig, and public exports.
- [ ] 2.2 Move terminal host input controller/types from `@agenter/termless-core` into `@agenter/termless-backend-utils`.
- [ ] 2.3 Remove terminal host input exports from `@agenter/termless-core`.
- [ ] 2.4 Keep dependency direction one-way: backend utils may depend on core; core must not depend on backend utils.

## 3. Composable Host Input Behavior

- [ ] 3.1 Add keyboard feature switches for all keyboard, key encoding, word navigation, keyboard selection, clear-selection-on-input, and follow-cursor-on-input.
- [ ] 3.2 Add pointer feature switches for all pointer, drag selection, semantic selection, and clear-selection-on-click.
- [ ] 3.3 Ensure disabled features are no-op/fallthrough paths with no backend state mutation.

## 4. BDD Coverage

- [ ] 4.1 Move existing host input BDD tests under the new package and rename ownership language away from `termless-core`.
- [ ] 4.2 Add BDD tests for disabled keyboard and disabled word navigation.
- [ ] 4.3 Add BDD tests for disabled semantic pointer selection and independently disabled drag selection.
- [ ] 4.4 Add BDD tests for disabling clear-selection and follow-cursor transaction steps.

## 5. Shell-next Integration

- [ ] 5.1 Update shell-next source/test imports to use `@agenter/termless-backend-utils` for host input controller/types.
- [ ] 5.2 Add `@agenter/termless-backend-utils` as a shell-next workspace dependency.
- [ ] 5.3 Confirm `extensions/cli-shell` remains untouched.

## 6. Verification And Commit

- [ ] 6.1 Run OpenSpec validation for `extract-termless-backend-utils`.
- [ ] 6.2 Run backend-utils typecheck and BDD tests.
- [ ] 6.3 Run termless-core typecheck.
- [ ] 6.4 Run shell-next typecheck and tests.
- [ ] 6.5 Run `git diff --check` and confirm no cli-shell diff.
- [ ] 6.6 Commit scoped changes without staging unrelated `openspec/.openspecui.json`.
