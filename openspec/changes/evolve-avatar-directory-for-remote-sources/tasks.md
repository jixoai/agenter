## 1. Durable model and contracts

- [ ] 1.1 Define durable source/package/install/provenance vocabulary across avatar-related specs and package-level contracts
- [ ] 1.2 Design the local avatar metadata shape that preserves source alias, package identity, revision, and install timestamp
- [ ] 1.3 Define source subscription and alias-management contracts for one or more avatar sources

## 2. Avatar Directory information architecture

- [ ] 2.1 Redesign the `Avatars` workbench IA around `My Avatars / Discover / Sources`
- [ ] 2.2 Specify how runtime tabs and avatar draft tabs stay layered on top of the unified directory shell
- [ ] 2.3 Define `My Avatars` provenance presentation so source facts stay secondary to runtime-first operation

## 3. Discover and install flow

- [ ] 3.1 Specify discover list behavior with name-primary and source-secondary identity hierarchy
- [ ] 3.2 Design the install flow with default remote naming and rename-on-conflict handling
- [ ] 3.3 Define the durable relationship between installed avatars and their upstream package revision

## 4. Source management surface

- [ ] 4.1 Design the visible `Sources` surface for adding, viewing, enabling, and differentiating subscribed sources
- [ ] 4.2 Define how source aliases such as `scope/repo` appear in list rows, install dialogs, and provenance views
- [ ] 4.3 Document non-goals for first-pass multi-source conflict resolution so future work does not overreach

## 5. Verification and rollout planning

- [ ] 5.1 Add Storybook DOM / contract coverage for the new Avatar Directory IA once implementation starts
- [ ] 5.2 Add backend and client-store behavior tests for install provenance retention and rename conflict handling
- [ ] 5.3 Update durable specs and design docs again once implementation turns this draft into concrete contracts
