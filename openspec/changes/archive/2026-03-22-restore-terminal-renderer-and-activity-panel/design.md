## Context

The current `TerminalPanel` is intentionally thin, but the result is a product regression: it no longer exposes the previously expected fit/cover controls, geometry/status affordances, or terminal-centric inspection. The renderer itself also now resets aggressively from snapshots and no longer preserves the richer rendering experience the user had before.

## Goals / Non-Goals

**Goals:**
- Restore renderer fidelity and stable fit behavior.
- Add explicit `fit` / `cover` controls to the terminal page.
- Prevent resize/snapshot feedback loops that cause jitter.
- Add a terminal-id-based activity inspector alongside the renderer.

**Non-Goals:**
- Redesign the full shell layout.
- Add remote transport support.
- Move all Devtools views into the terminal page.

## Decisions

### Fit remains the primary PTY sizing mode
The live PTY geometry follows container-driven fit semantics; `cover` changes presentation, not the PTY sizing contract.

Why: the user explicitly wants the old fit-driven terminal sizing back.

### Snapshot is fallback-only while transport is live
Once live transport is connected, prop-driven snapshot hydration must not keep resetting the xterm buffer.

Why: repeated fallback hydration is a root cause of jitter and visual rollback.

### Terminal page becomes a two-pane workbench
The page combines the renderer with a terminal-id-filtered activity inspector.

Why: the user asked for terminal-local inspection of reads/writes, related tool calls, and attention replies.

### Renderer controls belong to the terminal surface, not global shell chrome
Fit/cover and geometry controls live in the terminal panel header.

Why: they are terminal-local affordances, not app-global actions.

## Risks / Trade-offs

- [Renderer complexity] -> reintroducing richer controls can tempt UI logic back into the host; keep renderer and host responsibilities explicit.
- [Filtering quality] -> terminal-centric inspection depends on consistent terminalId extraction across facts and tool payloads.
- [Viewport regressions] -> terminal and inspector need separate but predictable scroll behavior.

## Migration Plan

1. Extend terminal-view host/element contracts for presentation mode and stable live transport behavior.
2. Restore terminal page controls and geometry/status affordances.
3. Add terminal-id-based activity aggregation in WebUI.
4. Add DOM/browser regression coverage for render quality and stability.
