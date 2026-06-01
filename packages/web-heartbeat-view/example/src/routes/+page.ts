import type { PageLoad } from "./$types";

export const load: PageLoad = ({ url }) => ({
  mode: url.searchParams.get("mode"),
  wsUrl: url.searchParams.get("wsUrl"),
});
