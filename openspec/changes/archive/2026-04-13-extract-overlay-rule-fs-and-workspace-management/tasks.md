## 1. Overlay rule filesystem package

- [x] 1.1 Create the `@agenter/just-bash-overlay-rule-fs` package and move the reusable workspace rule filesystem logic into it.
- [x] 1.2 Add unit coverage for ordered glob rules, directory visibility filtering, avatar-private isolation, and dynamic rule updates.

## 2. App-server integration

- [x] 2.1 Replace the app-server private granted-fs usage in root workspace bash and workspace bash with the new overlay-rule-fs package.
- [x] 2.2 Update app-server integration tests so both shell surfaces prove they share the same rule enforcement behavior.

## 3. Workspace management surface

- [x] 3.1 Add a workspace `ManagementDialog` in WebUI that lists avatar mount state for the current workspace and supports mount / unmount actions.
- [x] 3.2 Keep `Explorer / Rules / Private` as the file workflows after management actions, and add focused UI tests or DOM coverage for the dialog behavior.

## 4. Verification and closeout

- [x] 4.1 Run the required command-line real-AI validation for the workspace/runtime path first and record or fix any failures.
- [x] 4.2 Run browser walkthroughs after the CLI validation, covering the workspace management flow and confirming the workbench stays usable.
