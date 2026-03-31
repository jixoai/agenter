import type { AuthSessionProjection } from "@agenter/profile-service";

import type { AppKernel } from "../app-kernel";

export interface TrpcContext {
  kernel: AppKernel;
  auth: AuthSessionProjection | null;
}

export interface CreateTrpcContextInput {
  kernel: AppKernel;
  authorizationHeader?: string | null;
}

const readBearerToken = (value: string | null | undefined): string | null => {
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

export const createTrpcContext = async (input: AppKernel | CreateTrpcContextInput): Promise<TrpcContext> => {
  const kernel = input instanceof Object && "kernel" in input ? input.kernel : input;
  const authorizationHeader = input instanceof Object && "kernel" in input ? input.authorizationHeader : null;
  const token = readBearerToken(authorizationHeader);
  return {
    kernel,
    auth: token ? await kernel.authenticateAuthToken(token) : null,
  };
};
