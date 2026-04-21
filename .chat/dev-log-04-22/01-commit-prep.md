# 2026-04-22 Commit Prep

- User confirmed this round should be organized into a complete implementation commit, not a minimal follow-up-only commit.
- User confirmed the required real-AI walkthrough scope after commit: `workspace / attention / message / terminal / skill`.
- Current repository state contains many unrelated dirty paths, including `flutter-chat-view` and other OpenSpec changes. Commit preparation must isolate only `workspace-first-runtime-tool-surface` related artifacts.
- Verified evidence for the runtime tool-surface change now includes a persisted `ai_call.requestBody` integration test at `packages/app-server/test/workspace-tool-request-body.integration.test.ts`.
- Verified active source/spec residue scan for `root_workspace_*` is clean after removing the stale local `packages/webui/storybook-static` generated directory.
- Next action: inspect changed files, separate spec vs implementation boundaries, create atomic commits, then start real-AI walkthrough iteration.
