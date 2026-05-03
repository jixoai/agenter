import { redirect } from "@sveltejs/kit";
import { buildWorkspaceDetailHref, buildWorkspaceIndexHref } from "$lib/features/workspaces/workspace-location";

export const load = ({ url }: { url: URL }) => {
  const workspacePath = url.searchParams.get("path");
  if (!workspacePath) {
    throw redirect(307, buildWorkspaceIndexHref({ avatar: url.searchParams.get("avatar") }));
  }

  throw redirect(
    307,
    buildWorkspaceDetailHref({
      workspacePath,
      avatar: url.searchParams.get("avatar"),
      mode: url.searchParams.get("mode"),
      q: url.searchParams.get("q"),
    }),
  );
};
