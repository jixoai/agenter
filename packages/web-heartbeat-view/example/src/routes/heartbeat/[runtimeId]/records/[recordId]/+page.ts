import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params, url }) => ({
  runtimeId: params.runtimeId,
  recordId: params.recordId,
  mode: url.searchParams.get("mode"),
  pageSize: url.searchParams.get("pageSize"),
  wsUrl: url.searchParams.get("wsUrl"),
  silentConnect: url.searchParams.get("silentConnect"),
});
