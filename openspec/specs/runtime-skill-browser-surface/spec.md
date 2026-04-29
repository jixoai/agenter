# runtime-skill-browser-surface Specification

## Purpose

Define the read-only, bounded skill browser surface that exposes objective skill-root catalogs, file trees, and preview classification without granting arbitrary filesystem authority.

## Requirements

### Requirement: Browser skill browsing SHALL expose read-only bounded root catalogs

The platform SHALL expose a browser-facing read-only skill browser surface that lists visible skill roots without granting arbitrary filesystem authority. `shared`, `built-in`, and `global` catalogs SHALL return one row per visible skill. `avatars` catalogs SHALL return one row per avatar plus workspace-grouped avatar-private skill roots for that avatar. The platform SHALL keep the same inheritance order for visible runtime skills: `shared < built-in < global < avatar-private`.

#### Scenario: Built-in catalog returns one visible skill row per skill
- **WHEN** the browser requests the `built-in` skill catalog
- **THEN** the surface returns one row per visible built-in skill
- **AND** each row includes objective metadata such as `name`, `summary`, `rootKind`, and the real skill root identity needed for later tree reads

#### Scenario: Runtime-visible skill precedence follows the catalog inheritance order
- **WHEN** the platform resolves a skill name that exists in `shared`, `built-in`, `global`, and one avatar-private root
- **THEN** the visible runtime skill comes from the avatar-private root
- **AND** removing that avatar-private skill reveals the `global` version before the `built-in` version
- **AND** removing the `global` version reveals the `built-in` version before the `shared` version

#### Scenario: Avatar catalog groups skill roots by workspace
- **WHEN** the browser requests avatar skill roots for one avatar nickname
- **THEN** the response includes `Root workspace` first for the global avatar root
- **AND** each additional workspace group represents only that workspace's avatar-private skill root
- **AND** non-root workspaces with no avatar-private skills are omitted

### Requirement: Browser skill trees SHALL reflect objective files under one skill root

For any selected skill root, the browser skill surface SHALL return an objective file tree derived from the real directory contents under that root. It SHALL preserve directories and files as they exist on disk rather than synthesizing merged or virtual children.

#### Scenario: Skill tree exposes SKILL.md and sibling references objectively
- **WHEN** the browser requests the tree for one visible skill root that contains `SKILL.md` and `references/*.md`
- **THEN** the tree includes `SKILL.md`, the `references` directory, and the actual files inside it
- **AND** the response does not invent extra virtual nodes such as flattened reference summaries

#### Scenario: Avatar workspace groups stay separate in the tree surface
- **WHEN** the browser requests skill trees for one avatar across `Root workspace` and one non-root workspace
- **THEN** each group resolves only the files under its own workspace-scoped avatar skill root
- **AND** global avatar files are not duplicated into the non-root workspace tree

### Requirement: Browser file preview SHALL classify renderer kinds explicitly

The read-only skill browser surface SHALL classify each selected file into a stable preview kind so the WebUI can hand one payload to the universal `filePreviewer` shell and let that shell choose the concrete renderer. At minimum the surface SHALL distinguish `text`, `image`, `audio`, `video`, `pdf`, `directory`, `binary`, and `unsupported`.

#### Scenario: Markdown file resolves to text preview payload
- **WHEN** the browser requests a preview for `SKILL.md`
- **THEN** the surface returns `previewKind = "text"` plus bounded text content
- **AND** the browser route can hand that payload to `filePreviewer` for CodeMirror-based source rendering

#### Scenario: Pdf file resolves to pdf preview payload
- **WHEN** the browser requests a preview for a `.pdf` file inside a visible skill root
- **THEN** the surface returns `previewKind = "pdf"` plus the bounded payload needed for the universal preview entry
- **AND** the browser route does not need to parse pdf bytes inside the main workbench tree
