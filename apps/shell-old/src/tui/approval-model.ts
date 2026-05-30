import type { GlobalTerminalApprovalRequest, RuntimeClientState } from "@agenter/client-sdk";

export const APPROVAL_LEASE_DURATION_MS = 5 * 60_000;

export const resolvePendingTerminalApproval = (
  state: Pick<RuntimeClientState, "globalTerminalApprovalsById">,
  terminalId?: string,
): GlobalTerminalApprovalRequest | null => {
  const resources =
    terminalId && terminalId.length > 0
      ? [state.globalTerminalApprovalsById[terminalId]].filter(
          (resource): resource is NonNullable<typeof resource> => resource !== undefined,
        )
      : Object.values(state.globalTerminalApprovalsById);
  const requests = resources
    .flatMap((resource) => resource.data)
    .filter((request) => request.status === "pending")
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      return left.requestId.localeCompare(right.requestId);
    });
  return requests[0] ?? null;
};
