## 1. OpenSpec and durable law alignment

- [x] 1.1 Finalize proposal, design, and delta specs for `/admin`, workspace settings, runtime-tab placement, and shared workbench tabs
- [x] 1.2 Update `SPEC.md` and WebUI-facing durable docs so the primary navigation and admin/settings ownership match the new law
- [x] 1.3 Update the durable workbench chrome law so shared tabs now include a responsive toolbar companion below the tab row
- [x] 1.4 Update the durable workbench chrome law so tabs, toolbar, and body are modeled as one switched window surface
- [x] 1.5 Extend the durable workbench chrome law so route interiors use integrated page/pane surfaces and the toolbar exposes a distinct signal rail

## 2. Admin and workspace settings routes

- [x] 2.1 Move the current superadmin/profile route surface to `/admin` and wire the footer `super admin` entry in the app shell
- [x] 2.2 Rebuild `/avatars/settings` as a workspace settings workbench that uses the existing scoped settings graph APIs
- [x] 2.3 Port the legacy settings source/view, provenance jump, and split-vs-sheet detail behaviors into Svelte primitives

## 3. Workbench tabs and Avatars layout

- [x] 3.1 Replace the lightweight workbench tab strip with a shared chrome-style tabs primitive built on canonical Svelte shadcn/bits-ui composition
- [x] 3.2 Add explicit workbench open-tab state and real close/context-menu behaviors for Messages, Terminals, and running-avatar tabs
- [x] 3.3 Remove the redundant `Running Avatars` right-side card and compact sheet so Avatars runtime discoverability lives in dynamic tabs only
- [x] 3.4 Add a shared responsive toolbar companion below the tab row and migrate Avatars, Messages, and Terminals to the combined workbench chrome
- [x] 3.5 Add a shared workbench window shell that fuses tabs, toolbar, and body, then migrate Avatars, Messages, and Terminals to that single window primitive
- [x] 3.6 Introduce a shared integrated workbench scaffold, migrate window-root routes off detached card shells, and quiet remaining split panes

## 4. Verification

- [x] 4.1 Add or update Storybook DOM/unit coverage for workspace settings provenance behavior and chrome-tabs interactions
- [x] 4.2 Run targeted WebUI verification for typecheck, tests, and desktop/mobile navigation flows covering `/admin`, `/avatars/settings`, and workbench tab close behavior
- [x] 4.3 Expand workbench chrome verification so Storybook/tests cover toolbar rendering, responsive reflow, and the upgraded Chrome-like tab styling
- [x] 4.4 Expand workbench chrome verification so the fused window body is exercised alongside tabs and toolbar
- [x] 4.5 Re-run WebUI verification after the integrated page/pane scaffold and toolbar refinement pass, then close the new proof debt
