import type { AuthActorCatalogEntry, RuntimeStore } from "@agenter/client-sdk";
import { useCallback, useEffect, useState } from "react";

type AuthActorCatalogStore = Pick<RuntimeStore, "listAuthActors">;

export const useAuthActorCatalog = (runtimeStore: AuthActorCatalogStore, connected: boolean) => {
  const [items, setItems] = useState<AuthActorCatalogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!connected) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      setItems(await runtimeStore.listAuthActors());
      setError(null);
    } catch (loadError) {
      setItems([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [connected, runtimeStore]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    items,
    loading,
    error,
    refresh,
  };
};
