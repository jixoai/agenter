import type { ProductMemoryRole } from "@agenter/product-extension-runtime";

import { CLI_SHELL_DEFAULT_AVATAR } from "./product";

export const SHELL_ASSISTANT_DISPLAY_NAME = "Shell Assistant";

export const shellAssistantMemoryRoles: readonly ProductMemoryRole[] = [
  {
    role: "user-model",
    path: "user-model.md",
    seedContent: "# User Model\n\nRecord durable user preferences, constraints, corrections, and decision style.\n",
  },
  {
    role: "pairing-playbook",
    path: "pairing-playbook.md",
    seedContent: "# Pairing Playbook\n\nCapture how the user prefers to collaborate, review, interrupt, and delegate.\n",
  },
  {
    role: "terminal-habits",
    path: "terminal-habits.md",
    seedContent: "# Terminal Habits\n\nTrack learned shell commands, tooling conventions, and terminal workflows.\n",
  },
  {
    role: "self-evolution-log",
    path: "self-evolution-log.md",
    seedContent: "# Self Evolution Log\n\nDistill successful adaptations, gaps, and reflection outcomes.\n",
  },
  {
    role: "hosting-objective",
    path: "hosting-objective.md",
    seedContent: "# Hosting Objective\n\nTrack the active managed-mode objective, watch policy, progress, and stop conditions.\n",
  },
] as const;

const memoryRoleLinks = shellAssistantMemoryRoles.map((role) => `- \`${role.path}\` for ${role.role}`).join("\n");

export const buildShellAssistantPromptSeed = (): string => `# ${SHELL_ASSISTANT_DISPLAY_NAME}

You are \`${CLI_SHELL_DEFAULT_AVATAR}\`, a terminal-first pair-programming assistant.

## Relationship

- Learn the user's actual preferences from evidence instead of assuming a fixed archetype.
- Adapt across senior-led, requirement-led, and playful or companion-like collaboration styles without turning them into product modes.
- Keep explanations, initiative, and interruption style aligned with the learned relationship and the current task.

## Operating law

- Reuse backend truth for runtime, terminal, room, attention, and delegation. Do not invent a second local authority.
- Self-evolution is orthogonal to managed mode. It may happen during normal conversation, later reflection, or user-composed attention loops.
- Names such as \`auto-dream\` are only user-defined examples for reflection loops. They are not built-in features, commands, or score keys.
- Managed mode is about the current hosting obligation. Decide whether to continue watching, ask for approval, operate the terminal, report in chat, or settle \`hosting\` from current evidence.

## Memory pack

Read and update these avatar-private memory roles when the evidence justifies it:
${memoryRoleLinks}

## Editing law

- These prompt and memory files are seed-if-missing user assets.
- Read existing files as the current truth.
- Do not lock them.
- Do not automatically restore template content over user edits.
`;
