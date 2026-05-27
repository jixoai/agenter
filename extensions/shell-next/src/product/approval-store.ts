import type { GlobalTerminalApprovalRequest, RuntimeClientState } from "@agenter/client-sdk";

import type { ShellNextApprovalRequest, ShellNextApprovalStore } from "../surfaces/top-layer-surface";

export interface ShellNextRuntimeApprovalStoreInput {
  readonly store: {
    getState(): Pick<RuntimeClientState, "globalTerminalApprovalsById">;
    subscribe?(listener: () => void): () => void;
    hydrateGlobalTerminalApprovals(input: { terminalId: string; force?: boolean }): Promise<GlobalTerminalApprovalRequest[]>;
    approveGlobalTerminalRequest(input: {
      terminalId: string;
      requestId: string;
      durationMs: number;
    }): Promise<unknown>;
    denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown>;
  };
  readonly terminalId: string;
}

const toShellNextApprovalRequest = (request: GlobalTerminalApprovalRequest): ShellNextApprovalRequest => ({
  requestId: request.requestId,
  terminalId: request.terminalId,
  participantId: request.participantId,
  status: request.status,
  requestedInput: request.requestedInput,
  createdAt: request.createdAt,
});

export class ShellNextRuntimeApprovalStore implements ShellNextApprovalStore {
  readonly #store: ShellNextRuntimeApprovalStoreInput["store"];
  readonly #terminalId: string;

  constructor(input: ShellNextRuntimeApprovalStoreInput) {
    this.#store = input.store;
    this.#terminalId = input.terminalId;
  }

  getPendingApproval(): ShellNextApprovalRequest | null {
    const requests = this.#store.getState().globalTerminalApprovalsById[this.#terminalId]?.data ?? [];
    const pending = requests.find((request) => request.status === "pending") ?? null;
    return pending ? toShellNextApprovalRequest(pending) : null;
  }

  async approve(input: { terminalId: string; requestId: string; durationMs: number }): Promise<void> {
    await this.#store.approveGlobalTerminalRequest(input);
  }

  async deny(input: { terminalId: string; requestId: string }): Promise<void> {
    await this.#store.denyGlobalTerminalRequest(input);
  }

  async refresh(): Promise<void> {
    await this.#store.hydrateGlobalTerminalApprovals({
      terminalId: this.#terminalId,
      force: true,
    });
  }

  subscribe(listener: () => void): () => void {
    return this.#store.subscribe?.(listener) ?? (() => undefined);
  }
}

export const createShellNextRuntimeApprovalStore = (
  input: ShellNextRuntimeApprovalStoreInput,
): ShellNextApprovalStore => new ShellNextRuntimeApprovalStore(input);
