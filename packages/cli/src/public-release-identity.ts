import cliPackage from "../package.json";
import publicPackage from "../../agenter/package.json";

// File truth: compiled public CLI identity follows packages/agenter/package.json,
// while workspace launcher identity still follows packages/cli/package.json.
export function publicReleaseIdentity() {
  return {
    name: publicPackage.name,
    version: publicPackage.version,
  };
}

export function launcherPackageIdentity() {
  return {
    name: cliPackage.name,
    version: cliPackage.version,
  };
}

export function packageLauncherIdentity() {
  return {
    name: publicPackage.name,
    version: publicPackage.version,
  };
}
