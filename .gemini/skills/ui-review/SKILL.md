# ui-review Skill

## Description
This skill enforces the UI/UX visual regression workflow. It must be used whenever the user requests visual, layout, or UX interaction changes to the frontend (`packages/webui`, `svelte-components`, etc.). It ensures all changes are backed by visual proof and aligned with `DESIGN.md`.

## Instructions

Whenever you are tasked with a UI/UX improvement, you **MUST** follow this exact workflow:

### 1. The "Before" Capture (Mandatory First Step)
Before editing *any* frontend code, capture the baseline state to ensure you have a reference and that the dev server is running.
- Identify the URL (e.g., `http://localhost:5173/workspaces`).
- Identify a distinct piece of text or a CSS selector that proves the DOM has finished loading (e.g., `"Choose workspace root"` or `".page-content"`).
- Run the capture script:
  ```bash
  ./.gemini/scripts/ui-capture.sh <topic-name> <url> "<wait-text-or-selector>" before
  ```
  *(If the server isn't running, start it in the background first using `bun run dev --port 5173` in the `packages/webui` dir).*

### 2. Implement the Design
- Review `DESIGN.md` for layout and structural constraints.
- Make your code changes. 
- *Crucial Rule:* Never use inline SVGs, always use `lucide-svelte`. Always respect the `chrome-window` and `page-content` boundaries.

### 3. The "After" Capture & Rationale
Once changes are made and the server has hot-reloaded:
- Run the capture script for the new state:
  ```bash
  ./.gemini/scripts/ui-capture.sh <topic-name> <url> "<wait-text-or-selector>" after
  ```
- Edit the auto-generated `.screenshot/<topic-name>/README.md` file. Explain your UI/UX decisions, explicitly referencing `DESIGN.md` rules (e.g., information density, muscle-memory shortcuts, compact-mode).

### 4. Present to User
Inform the user that the Before/After comparison is ready in `.screenshot/<topic-name>/` and summarize your design rationale.

## Available Resources
- `DESIGN.md`: The single source of truth for UI/UX physics and layout rules.
- `.gemini/scripts/ui-capture.sh`: The automated capture and scaffold tool.
