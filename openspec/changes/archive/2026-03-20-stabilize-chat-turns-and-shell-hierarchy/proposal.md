## Why

The current WebUI still violates the intended chat-first contract in two ways: background LoopBus cycles leak into the main Chat stage, and stalled model calls remain effectively invisible until they finish. At the same time, the shell repeats the same workspace and session facts across multiple chrome layers, so the app feels noisy instead of hierarchical.

## What Changes

- Stabilize model-call lifecycle handling so runtime and Devtools can observe a call when it starts, when it completes, and when it fails or times out.
- Tighten the chat projection contract so Chat only renders user-visible turns instead of background terminal, attention, or tool-only cycles.
- Refine workspace shell hierarchy so the sidebar, app header, workspace context bar, and chat toolbar each own a distinct layer of information without repeating the same labels or context.
- Improve Devtools model inspection so an in-flight call is visible immediately with its request payload, and a stalled call becomes a persisted recoverable error instead of hanging indefinitely.
- **BREAKING**: Chat route visibility changes from “all persisted cycles may appear if projected” to “only user-visible cycles are rendered in Chat”; background cycles remain available only in Devtools and storage APIs.

## Capabilities

### New Capabilities
- `model-call-lifecycle`: defines the observable lifecycle contract for runtime model calls, including running, done, and timeout/error states.

### Modified Capabilities
- `chat-cycles`: chat cycle projection and runtime cycle updates now distinguish between persisted cycles and chat-visible conversation turns.
- `webui-chat-navigation`: workspace shell hierarchy and chat-stage rendering change so Chat is user-facing while Devtools owns technical inspection.

## Impact

- Affected code spans `packages/session-system`, `packages/app-server`, `packages/client-sdk`, and `packages/webui`.
- Runtime event payloads and stored model-call records gain lifecycle state instead of completion-only records.
- Chat projection tests, runtime-store tests, WebUI Storybook DOM tests, and browser walkthrough coverage all need updates.
