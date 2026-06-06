import type { PageLoad } from "./$types";

export const load: PageLoad = ({ url }) => ({
  mode: url.searchParams.get("mode"),
  pageSize: url.searchParams.get("pageSize"),
  wsUrl: url.searchParams.get("wsUrl"),
  silentConnect: url.searchParams.get("silentConnect"),
});
