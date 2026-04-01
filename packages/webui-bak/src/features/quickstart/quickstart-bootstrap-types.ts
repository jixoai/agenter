export interface QuickstartRoomParticipant {
  id: string;
  label?: string;
}

export interface QuickstartRoomConfig {
  title: string;
  participants: QuickstartRoomParticipant[];
  metadata: Record<string, unknown>;
  adminToken: string;
}

export interface QuickstartTerminalConfig {
  terminalId: string;
  command: string[];
  cwd?: string;
  focus: boolean;
  autoRun: boolean;
}

export interface QuickstartBootstrapConfig {
  room: QuickstartRoomConfig;
  terminals: QuickstartTerminalConfig[];
}

export const DEFAULT_QUICKSTART_BOOTSTRAP_CONFIG: QuickstartBootstrapConfig = {
  room: {
    title: "",
    participants: [],
    metadata: {},
    adminToken: "",
  },
  terminals: [],
};
