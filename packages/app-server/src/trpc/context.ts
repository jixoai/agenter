import type { AppKernel } from "../app-kernel";

export interface TrpcContext {
  kernel: AppKernel;
}

export const createTrpcContext = (kernel: AppKernel): TrpcContext => ({ kernel });
