import type { AuthSessionProjection } from "@agenter/auth-service";

import type { AppKernel } from "../app-kernel";

export interface TrpcContext {
  kernel: AppKernel;
  auth: AuthSessionProjection | null;
  resolveMcpInspectorWsUrl?: (input: { avatarNickname?: string | null; leaseId: string }) => string;
}

export interface CreateTrpcContextInput {
  kernel: AppKernel;
  authorizationHeader?: string | null;
  resolveMcpInspectorWsUrl?: (input: { avatarNickname?: string | null; leaseId: string }) => string;
}

export const readBearerToken = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  if (!normalized.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = normalized.slice("bearer ".length).trim();
  return token.length > 0 ? token : null;
};

const isCreateTrpcContextInput = (input: AppKernel | CreateTrpcContextInput): input is CreateTrpcContextInput =>
  typeof input === "object" && input !== null && "kernel" in input;

export const createTrpcContext = async (input: AppKernel | CreateTrpcContextInput): Promise<TrpcContext> => {
  const contextInput = isCreateTrpcContextInput(input) ? input : null;
  const kernel = contextInput ? contextInput.kernel : input;
  const authorizationHeader = contextInput?.authorizationHeader ?? null;
  const token = readBearerToken(authorizationHeader);
  return {
    kernel,
    auth: token ? await kernel.authenticateAuthToken(token) : null,
    resolveMcpInspectorWsUrl: contextInput?.resolveMcpInspectorWsUrl,
  };
};
