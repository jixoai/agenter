## Context

The kernel change makes contexts the live state and commits the history. Devtools therefore needs to make context state and commit hook outcomes inspectable without exposing old LoopBus-centric buckets.

## Goals / Non-Goals

**Goals**
- Make context state the primary attention inspection surface.
- Make commit history explicit and navigable.
- Show hook results on both commit detail and cycle detail.
- Keep Chat free from raw technical attention output.

**Non-Goals**
- Rebuild the full chat composer or terminal panel.
- Preserve the old item/ref vocabulary for compatibility.

## Decisions

### Context tab leads
The default attention tab is `Context` and shows:
- `contextId`
- owner
- head commit
- current content
- current score map

Why: this is the live state the loop reasons about.

### Commits tab is the log
The second tab is `Commits` and shows immutable commit history, summaries, change payloads, and hook results.

Why: commit history explains how the state evolved.

### Cycles show commits and hooks
Cycle detail should show:
- input contexts
- produced commits
- hook outcomes
- model calls

Why: this is the shortest path to proving whether unresolved work still exists and whether a reply actually got sent.

### Chat stays message-only
Chat renders only real message-system messages.

Why: hook/tool/commit detail belongs in Devtools.
