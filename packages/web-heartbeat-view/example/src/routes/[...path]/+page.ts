import type { PageLoad } from "./$types";

const parseHeartbeatPath = (
  path: string | undefined,
): {
  runtimeId: string | null;
  recordId: string | null;
} => {
  if (!path) {
    return {
      runtimeId: null,
      recordId: null,
    };
  }
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "heartbeat" || !parts[1]) {
    return {
      runtimeId: null,
      recordId: null,
    };
  }
  return {
    runtimeId: parts[1],
    recordId: parts[2] === "records" && parts[3] ? parts[3] : null,
  };
};

export const load: PageLoad = ({ params, url }) => {
  const route = parseHeartbeatPath(params.path);
  return {
    embed: route.runtimeId !== null,
    runtimeId: route.runtimeId,
    recordId: route.recordId,
    mode: url.searchParams.get("mode"),
    pageSize: url.searchParams.get("pageSize"),
    wsUrl: url.searchParams.get("wsUrl"),
    silentConnect: url.searchParams.get("silentConnect"),
  };
};
