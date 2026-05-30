import type { GlobalTerminalApprovalRequest, RuntimeClientState } from "@agenter/client-sdk";

import type { ShellApprovalRequest, ShellApprovalStore } from "../surfaces/top-layer-surface";

export interface ShellRuntimeApprovalStoreInput {
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

const toShellApprovalRequest = (request: GlobalTerminalApprovalRequest): ShellApprovalRequest => ({
  requestId: request.requestId,
  terminalId: request.terminalId,
  participantId: request.participantId,
  status: request.status,
  requestedInput: request.requestedInput,
  createdAt: request.createdAt,
});

export class ShellRuntimeApprovalStore implements ShellApprovalStore {
  readonly #store: ShellRuntimeApprovalStoreInput["store"];
  readonly #terminalId: string;

  constructor(input: ShellRuntimeApprovalStoreInput) {
    this.#store = input.store;
    this.#terminalId = input.terminalId;
  }

  getPendingApproval(): ShellApprovalRequest | null {
    const requests = this.#store.getState().globalTerminalApprovalsById[this.#terminalId]?.data ?? [];
    const pending = requests.find((request) => request.status === "pending") ?? null;
    return pending ? toShellApprovalRequest(pending) : null;
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

export const createShellRuntimeApprovalStore = (
  input: ShellRuntimeApprovalStoreInput,
): ShellApprovalStore => new ShellRuntimeApprovalStore(input);
