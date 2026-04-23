# 2026-04-23 Terminal skill real-AI dogfood

## Objective facts

- Goal of this round:
  - verify whether a real runtime AI can self-learn terminal usage instead of being hand-held by the engineer
  - use `ai_call` request/tool evidence as the source of truth
- Task used for dogfood:
  - in a granted temp workspace
  - must use runtime terminal, not one-shot bash file write
  - start interactive `cat > proof.txt`
  - make `proof.txt` become exactly:
    - `<key data="enter"/>`
    - `done`
  - prompt only suggested:
    - prefer `terminal write`
    - if not suitable, investigate the correct terminal command and syntax yourself

## First real-AI run

- Result: failed
- Observable behavior:
  - the AI did investigate on its own
  - it used:
    - `terminal --help`
    - `terminal create --help`
    - `terminal write --help`
    - `terminal input --help`
    - direct read of `references/input-modes.md`
  - but it did **not** use the canonical `skill info agenter-terminal` path
  - it guessed mixed syntax incorrectly:
    - used literal `<key data="enter"/>` outside `<raw>`
    - used `data="C-d"` instead of `data="d" ctrl="true"`
- Broken output observed:
  - `proof.txt` became `\\n\\ndone\\nC-dC-crm -f proof.txt\\n`

## Root cause derived from evidence

- The AI was not completely blind; it really did self-investigate.
- The failure came from missing durable guidance for one high-risk mixed pattern:
  - when a literal line itself looks like `<key .../>`
  - and the same payload also needs a real control combo such as EOF
- Existing help/reference did not say this clearly enough:
  - whole literal line must stay inside `<raw>...</raw>`
  - Ctrl combos use `ctrl="true"`
  - EOF is `<key data="d" ctrl="true"/>`

## Repairs made

- `packages/terminal-system/skills/terminal/references/input-modes.md`
  - added explicit law for whole literal tag-like lines inside one raw block
  - added explicit Ctrl syntax law
  - added exact interactive `cat > file` example with literal `<key .../>` plus EOF
- `packages/terminal-system/skills/terminal/SKILL.md`
  - added concise mixed-mode law for literal tag-like lines and Ctrl combos
- `packages/app-server/src/runtime-tool-descriptors.ts`
  - `terminal input --help` now includes the same Ctrl/raw guidance
  - argv example now demonstrates literal-tag + EOF pattern
- regenerated:
  - `packages/app-server/src/generated/runtime-skill-catalog.generated.ts`

## Second real-AI run

- Result: success on the core skill-learning task
- The AI autonomously used:
  - `skill info agenter-terminal`
  - `terminal create --help`
  - `terminal write --help`
  - `terminal input --help`
  - later `references/input-modes.md`
- The AI first tried a wrong mixed form, inspected the file truth, corrected itself, and then converged on:
  - `terminal write` to start `cat > proof.txt`
  - `terminal input` with
    - `<raw>&lt;key data=\"enter\"/&gt;\ndone\n</raw><key data=\"d\" ctrl=\"true\"/>`
- Final objective file truth:
  - `proof.txt == "<key data=\"enter\"/>\\ndone\\n"`

## Important nuance

- My diagnostic script flagged `directProofWriteByShell`, but that flag was noisy:
  - the AI only used shell reads such as `cat`, `od`, `xxd`
  - no direct one-shot shell write to `proof.txt` was observed in the successful run
- I also tried to wait for a final room message containing `已完成`.
  - that extra check timed out in one follow-up run
  - so the strongest proven fact is:
    - the real AI did self-learn enough terminal syntax to produce the correct file truth
  - the room-reply end-to-end closure was not proven in that final follow-up script
