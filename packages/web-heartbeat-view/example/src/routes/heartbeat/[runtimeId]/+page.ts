import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params, url }) => ({
  runtimeId: params.runtimeId,
  mode: url.searchParams.get("mode"),
  wsUrl: url.searchParams.get("wsUrl"),
});
