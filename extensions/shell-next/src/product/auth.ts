import type { ShellNextAutoLoginResult } from "./bootstrap";

export interface ShellNextAuthenticationStore {
  autoLogin(): Promise<ShellNextAutoLoginResult>;
  setAuthToken(token: string | null | undefined): void;
  getAuthToken?(): string | null;
}

export const ensureShellNextAuthenticated = async (store: ShellNextAuthenticationStore): Promise<void> => {
  if (store.getAuthToken?.()) {
    return;
  }
  const autoLogin = await store.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`shell-next auto login failed: ${autoLogin.reason}: ${autoLogin.message}`);
  }
  store.setAuthToken(autoLogin.session.token);
};
