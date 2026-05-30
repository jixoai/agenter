import type { ShellAutoLoginResult } from "./bootstrap";

export interface ShellAuthenticationStore {
  autoLogin(): Promise<ShellAutoLoginResult>;
  setAuthToken(token: string | null | undefined): void;
  getAuthToken?(): string | null;
}

export const ensureShellAuthenticated = async (store: ShellAuthenticationStore): Promise<void> => {
  if (store.getAuthToken?.()) {
    return;
  }
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`shell auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};
