import type { RuntimeConnectionStatus } from "@agenter/client-sdk";
import { createContext, useContext } from "react";

interface ShellLayoutContextValue {
  showNavigationTrigger: boolean;
  connectionStatus: RuntimeConnectionStatus;
  aiStatus: string | null;
  onOpenNavigation: () => void;
}

const ShellLayoutContext = createContext<ShellLayoutContextValue | null>(null);

export const ShellLayoutProvider = ShellLayoutContext.Provider;

export const useShellLayout = (): ShellLayoutContextValue => {
  const value = useContext(ShellLayoutContext);
  if (!value) {
    throw new Error("ShellLayoutContext is not available");
  }
  return value;
};
