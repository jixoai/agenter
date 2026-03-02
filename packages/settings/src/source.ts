import type { BuiltinSettingsSource, SettingsSourceDescriptor, SettingsSourceInput } from "./types";
import { ResourceLoader } from "./resource-loader";

const DEFAULT_SOURCES: BuiltinSettingsSource[] = ["user", "project", "local"];

export const settingsSource = (
  input: SettingsSourceInput[] | undefined,
  options: { projectRoot: string; cwd?: string; homeDir?: string; loader?: ResourceLoader },
): SettingsSourceDescriptor[] => {
  const loader =
    options.loader ??
    new ResourceLoader({
      context: {
        projectRoot: options.projectRoot,
        cwd: options.cwd,
        homeDir: options.homeDir,
      },
    });
  const sources = input && input.length > 0 ? input : DEFAULT_SOURCES;

  return sources.map((token) => {
    const resource = loader.resolve(token, { forSettings: true });
    if (token === "user" || token === "project" || token === "local") {
      return {
        id: token,
        kind: "builtin",
        builtin: token,
        uri: resource.uri,
        path: resource.path ?? resource.uri,
      };
    }
    return {
      id: token,
      kind: "file",
      uri: resource.uri,
      path: resource.path ?? resource.uri,
    };
  });
};
