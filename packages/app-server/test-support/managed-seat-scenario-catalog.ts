export const MANAGED_SEAT_REQUIRED_ARCHETYPES = [
  "pair-debugging",
  "temporary-takeover",
  "teaching-walkthrough",
  "room-routed-delivery",
  "unilateral-config",
  "revoke-or-expiry",
  "management-handoff",
  "cross-instance-collaboration",
] as const;

export type ManagedSeatScenarioArchetype = (typeof MANAGED_SEAT_REQUIRED_ARCHETYPES)[number];

export type ManagedSeatScenarioTopology =
  | "same-instance-room-transport"
  | "same-instance-lifecycle"
  | "cross-instance-room-transport";

export interface ManagedSeatScenarioDefinition {
  id: string;
  archetype: ManagedSeatScenarioArchetype;
  topology: ManagedSeatScenarioTopology;
  setup: {
    sharedRoomRequired: boolean;
    targetSystem: "terminal" | "message";
    resourceAuthorities: readonly string[];
    facts: readonly string[];
  };
  objective: readonly string[];
  invariants: readonly string[];
  success: readonly string[];
  failureEvidence: readonly string[];
}

export const MANAGED_SEAT_PROMPT_LAW = [
  "Describe people, systems, and the intended outcome.",
  "Keep resource authority in native grammar such as RW or TM when it matters.",
  "Judge success from durable room, seat, descriptor, and terminal facts.",
  "Do not prescribe exact command names, exact message wording, or a single rigid action order when equivalent lawful behavior exists.",
] as const;

const catalog = [
  {
    id: "terminal-pair-debugging",
    archetype: "pair-debugging",
    topology: "same-instance-room-transport",
    setup: {
      sharedRoomRequired: true,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "Two principals already share one room and can talk there.",
        "One principal owns the terminal authority and offers direct writer access to the other principal.",
        "The room transports the invitation, but the terminal remains the authority owner.",
      ],
    },
    objective: [
      "The invitee joins the same terminal truth and performs one visible debugging action.",
      "Both participants can observe the same resulting terminal output.",
    ],
    invariants: [
      "Room transport must not become terminal authority ownership.",
      "Writer access means direct terminal operation after acceptance.",
    ],
    success: [
      "The invitation becomes accepted.",
      "A visible terminal marker written by the invitee is readable by both participants.",
    ],
    failureEvidence: ["room-truth", "seat-timeline", "descriptor-form", "terminal-observation"],
  },
  {
    id: "terminal-temporary-takeover",
    archetype: "temporary-takeover",
    topology: "same-instance-room-transport",
    setup: {
      sharedRoomRequired: true,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "The primary operator is blocked and asks another principal to take over briefly.",
        "The invitee only needs enough authority to perform the fix and show the result.",
      ],
    },
    objective: [
      "The invitee takes temporary control, performs one visible fix action, and reports back in the room.",
    ],
    invariants: [
      "The shared room remains communication transport, not the place where terminal authority lives.",
    ],
    success: [
      "The shared terminal reflects the invitee's visible fix marker.",
      "The room contains a durable handoff acknowledgement or delivery update.",
    ],
    failureEvidence: ["room-truth", "seat-timeline", "terminal-observation"],
  },
  {
    id: "terminal-teaching-walkthrough",
    archetype: "teaching-walkthrough",
    topology: "same-instance-room-transport",
    setup: {
      sharedRoomRequired: true,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "The owner wants the invitee to demonstrate a procedure on the shared terminal rather than silently fix it.",
        "The invitee should leave visible steps that the owner can inspect afterwards.",
      ],
    },
    objective: [
      "The invitee performs a visible guided action on the terminal and leaves enough output for the owner to inspect.",
    ],
    invariants: [
      "Shared terminal truth must remain readable by both sides.",
    ],
    success: [
      "The owner can read the invitee's walkthrough marker from the same terminal.",
    ],
    failureEvidence: ["terminal-observation", "seat-timeline"],
  },
  {
    id: "terminal-room-routed-delivery",
    archetype: "room-routed-delivery",
    topology: "same-instance-room-transport",
    setup: {
      sharedRoomRequired: true,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "The invitation descriptor is delivered through a room message instead of being pasted out-of-band.",
      ],
    },
    objective: [
      "The invitee accepts the descriptor that arrived through the room and begins using the terminal.",
    ],
    invariants: [
      "Descriptor delivery is a projection over the same invitation truth.",
    ],
    success: [
      "The delivered descriptor text is visible in room transcript and still resolves to one accepted invitation.",
    ],
    failureEvidence: ["room-truth", "descriptor-form", "seat-timeline"],
  },
  {
    id: "terminal-unilateral-config",
    archetype: "unilateral-config",
    topology: "same-instance-lifecycle",
    setup: {
      sharedRoomRequired: false,
      targetSystem: "terminal",
      resourceAuthorities: ["RW", "RO"],
      facts: [
        "A managed seat is already accepted and active.",
        "The manager can tighten or relax authority without asking for a second acceptance.",
      ],
    },
    objective: [
      "The manager changes the accepted seat from direct write access to readonly containment.",
    ],
    invariants: [
      "Accepted seat mutation is unilateral manager authority.",
    ],
    success: [
      "The invitee loses write ability without re-accepting the seat.",
    ],
    failureEvidence: ["seat-timeline", "terminal-observation"],
  },
  {
    id: "terminal-revoke-or-expiry",
    archetype: "revoke-or-expiry",
    topology: "same-instance-lifecycle",
    setup: {
      sharedRoomRequired: false,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "A pending invitation can be replaced, revoked, or allowed to expire before acceptance.",
      ],
    },
    objective: [
      "Only the newest still-pending descriptor can activate authority.",
    ],
    invariants: [
      "Descriptor text may still parse after rotation, revoke, or expiry, but stale authority must not activate.",
    ],
    success: [
      "Expired or revoked descriptors fail acceptance.",
      "A renewed pending invitation carries the fresh authority window.",
    ],
    failureEvidence: ["seat-timeline", "descriptor-form"],
  },
  {
    id: "terminal-management-handoff",
    archetype: "management-handoff",
    topology: "same-instance-lifecycle",
    setup: {
      sharedRoomRequired: false,
      targetSystem: "terminal",
      resourceAuthorities: ["TM"],
      facts: [
        "The owner grants terminal management capability to another principal.",
        "Management capability does not erase current-admin semantics.",
      ],
    },
    objective: [
      "The invitee becomes a durable admin-capable seat without flattening current-admin truth.",
    ],
    invariants: [
      "Resource-native TM grammar stays terminal-owned.",
      "Admin-candidate truth remains separate from current-admin truth.",
    ],
    success: [
      "The invitee becomes an admin-capable seat and appears in admin-candidate truth.",
    ],
    failureEvidence: ["seat-timeline", "terminal-observation"],
  },
  {
    id: "terminal-cross-instance-collaboration",
    archetype: "cross-instance-collaboration",
    topology: "cross-instance-room-transport",
    setup: {
      sharedRoomRequired: true,
      targetSystem: "terminal",
      resourceAuthorities: ["RW"],
      facts: [
        "Room transport and terminal authority are hosted by different agenter processes.",
        "The invitee accepts the descriptor from one process and collaborates with a terminal hosted by the other process.",
      ],
    },
    objective: [
      "The invitee joins the remote terminal and performs one visible command through the stored remote seat.",
    ],
    invariants: [
      "Cross-process transport must not re-home resource authority.",
    ],
    success: [
      "A marker written from one process is readable from both processes against the same terminal truth.",
    ],
    failureEvidence: ["room-truth", "seat-timeline", "descriptor-form", "terminal-observation", "port-or-process"],
  },
] as const satisfies readonly ManagedSeatScenarioDefinition[];

const FORBIDDEN_PROMPT_PATTERNS = [
  /\bterminal-manage\b/iu,
  /\bmessage-manage\b/iu,
  /\bterminal write\b/iu,
  /\bterminal read\b/iu,
  /\bmessage send\b/iu,
  /\broot_bash\b/iu,
  /\bworkspace_bash\b/iu,
  /--help/iu,
  /```/u,
] as const;

export const listManagedSeatValidationScenarios = (): readonly ManagedSeatScenarioDefinition[] => catalog;

export const getManagedSeatValidationScenario = (id: string): ManagedSeatScenarioDefinition => {
  const scenario = catalog.find((entry) => entry.id === id);
  if (!scenario) {
    throw new Error(`unknown managed-seat scenario: ${id}`);
  }
  return scenario;
};

export const buildManagedSeatSituationBrief = (scenario: ManagedSeatScenarioDefinition): string =>
  [
    "Situation",
    ...scenario.setup.facts.map((fact) => `- ${fact}`),
    "Objective",
    ...scenario.objective.map((goal) => `- ${goal}`),
    "Invariants",
    ...scenario.invariants.map((item) => `- ${item}`),
  ].join("\n");

export const findManagedSeatPromptLawViolations = (input: string): string[] =>
  FORBIDDEN_PROMPT_PATTERNS.flatMap((pattern) => (pattern.test(input) ? [pattern.source] : []));
