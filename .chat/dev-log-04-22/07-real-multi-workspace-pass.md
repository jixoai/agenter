## Step

real AI walkthrough for `multi-workspace`

## Request

prove the new workspace-first runtime tool surface works in a single runtime with multiple mounted workspaces, and verify the avatar can use `skill info` plus the new workspace tools correctly.

## Evidence

- test command: `AGENTER_RUN_REAL_LOOPBUS=1 bun test packages/app-server/test/real-multi-workspace.integration.test.ts`
- result: pass
- duration: about 60s
- verified assistant behavior:
  - used `root_bash` to run `skill info agenter-runtime`
  - used `workspace_list`
  - used `workspace_bash` against both mounted workspace ids
  - moved verified content from source workspace to target workspace
  - final assistant reply matched `MULTI-WORKSPACE-OK`
- verified file result:
  - target workspace `result.txt` contains `TARGET-RESULT: ALPHA`

## Notes

- this pass closes the missing proof that one runtime can hold multiple mounted workspaces without falling back to legacy `root_workspace_*` tools.
- next step is residue scan plus attention/skill coverage audit, especially dynamic skill change propagation into attention commits.
