import type { TerminalTransportClientMessage, TerminalTransportServerMessage } from "./index";

export const TERMINAL_TRANSPORT_DIRECT_REGISTRY_KEY = "@agenter/terminal-transport/direct-registry/v1";

export interface TerminalTransportDirectEndpoint {
  readonly upgradeId: string;
  readonly clientToken: string;
  readonly serverToken: string;
  acceptClient(input: {
    clientToken: string;
    onServerMessage(message: TerminalTransportServerMessage): void;
    onClose(): void;
  }): TerminalTransportDirectConnection | null;
}

export interface TerminalTransportDirectConnection {
  sendClientMessage(message: TerminalTransportClientMessage): boolean;
  close(): void;
}

export interface TerminalTransportDirectRegistry {
  register(endpoint: TerminalTransportDirectEndpoint): () => void;
  claim(upgradeId: string, serverToken: string): TerminalTransportDirectEndpoint | null;
}

const globalRegistrySymbol = Symbol.for(TERMINAL_TRANSPORT_DIRECT_REGISTRY_KEY);

type DirectRegistryGlobal = typeof globalThis & {
  [globalRegistrySymbol]?: TerminalTransportDirectRegistry;
};

export const getTerminalTransportDirectRegistry = (): TerminalTransportDirectRegistry | null => {
  const target = globalThis as DirectRegistryGlobal;
  const existing = target[globalRegistrySymbol];
  if (existing) {
    return existing;
  }
  const endpoints = new Map<string, TerminalTransportDirectEndpoint>();
  const registry: TerminalTransportDirectRegistry = {
    register(endpoint) {
      endpoints.set(endpoint.upgradeId, endpoint);
      return () => {
        if (endpoints.get(endpoint.upgradeId) === endpoint) {
          endpoints.delete(endpoint.upgradeId);
        }
      };
    },
    claim(upgradeId, serverToken) {
      const endpoint = endpoints.get(upgradeId);
      if (!endpoint || endpoint.serverToken !== serverToken) {
        return null;
      }
      return endpoint;
    },
  };
  target[globalRegistrySymbol] = registry;
  return registry;
};

export const canUseTerminalTransportDirectRegistry = (): boolean =>
  typeof globalThis === "object" && globalThis !== null && getTerminalTransportDirectRegistry() !== null;
