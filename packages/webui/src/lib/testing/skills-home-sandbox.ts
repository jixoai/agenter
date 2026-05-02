import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const PLAYGROUND_MARKER_BASENAME = ".agenter-skills-playground-sandbox";
const HOME_MARKER_BASENAME = ".agenter-skills-home-sandbox";
const WORKSPACE_MARKER_BASENAME = ".agenter-skills-workspace-sandbox";

export interface SkillsHomeSandboxPaths {
	homeDir: string;
	playgroundRoot: string;
	playgroundMarkerPath: string;
	workspacePath: string;
	workspaceMarkerPath: string;
	homeMarkerPath: string;
}

export const resolveSkillsHomeSandboxPaths = (homeArg: string): SkillsHomeSandboxPaths => {
	const homeDir = resolve(homeArg);
	const playgroundRoot = resolve(homeDir, "..");
	const workspacePath = join(playgroundRoot, "workspaces", "skills-lab");
	return {
		homeDir,
		playgroundRoot,
		playgroundMarkerPath: join(playgroundRoot, PLAYGROUND_MARKER_BASENAME),
		workspacePath,
		workspaceMarkerPath: join(workspacePath, WORKSPACE_MARKER_BASENAME),
		homeMarkerPath: join(homeDir, HOME_MARKER_BASENAME),
	};
};

const isDescendantOf = (parentPath: string, childPath: string): boolean => {
	const relation = relative(resolve(parentPath), resolve(childPath));
	return relation === "" || (!relation.startsWith("..") && relation !== ".");
};

const ensureSandboxOwnership = (paths: SkillsHomeSandboxPaths): void => {
	if (!isDescendantOf(paths.playgroundRoot, paths.homeDir) || !isDescendantOf(paths.playgroundRoot, paths.workspacePath)) {
		throw new Error(`invalid skills sandbox layout under ${paths.playgroundRoot}`);
	}

	const playgroundInitialized = existsSync(paths.playgroundMarkerPath);
	const homeExists = existsSync(paths.homeDir);
	const workspaceExists = existsSync(paths.workspacePath);

	if ((homeExists || workspaceExists) && !playgroundInitialized) {
		throw new Error(
			`refusing to clear unmanaged skills sandbox root: ${paths.playgroundRoot}. ` +
				`Expected marker ${PLAYGROUND_MARKER_BASENAME}.`,
		);
	}
};

const writeSandboxMarker = (path: string, label: string): void => {
	writeFileSync(path, `${label}\n`, "utf8");
};

export const resetSkillsHomeSandbox = (homeArg: string): SkillsHomeSandboxPaths => {
	const paths = resolveSkillsHomeSandboxPaths(homeArg);
	ensureSandboxOwnership(paths);

	rmSync(paths.homeDir, { recursive: true, force: true });
	rmSync(paths.workspacePath, { recursive: true, force: true });

	mkdirSync(paths.playgroundRoot, { recursive: true });
	mkdirSync(paths.homeDir, { recursive: true });
	mkdirSync(paths.workspacePath, { recursive: true });

	writeSandboxMarker(paths.playgroundMarkerPath, "agenter skills playground sandbox");
	writeSandboxMarker(paths.homeMarkerPath, "agenter skills home sandbox");
	writeSandboxMarker(paths.workspaceMarkerPath, "agenter skills workspace sandbox");

	return paths;
};
