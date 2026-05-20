import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const workspacesWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "workspaces-workbench-layout.svelte"),
  "utf8",
);

describe("Feature: Workspaces shell toolbar contract", () => {
  test("Scenario: Given the workspace shell summary toolbar follows the shared page-toolbar law When reading the source Then the shell binds identity and status through the shared primitive instead of the legacy meta compat slot", () => {
    expect(workspacesWorkbenchLayoutSource).toContain("WorkbenchToolbarStatus");
    expect(workspacesWorkbenchLayoutSource).toContain("identityLeading={workspacesToolbarIdentityLeading}");
    expect(workspacesWorkbenchLayoutSource).toContain("identityTitle={workspacesToolbarIdentityTitle}");
    expect(workspacesWorkbenchLayoutSource).toContain("identitySubtitle={workspacesToolbarIdentitySubtitle}");
    expect(workspacesWorkbenchLayoutSource).toContain("status={workspacesToolbarStatus}");
    expect(workspacesWorkbenchLayoutSource).not.toContain("meta={workspacesToolbarMeta}");
  });

  test("Scenario: Given workspace detail pages own nested scroll regions When reading the layout source Then the outer window body stays in fill mode instead of wrapping the entire route in one extra scroll viewport", () => {
    expect(workspacesWorkbenchLayoutSource).toContain('bodyMode="fill"');
    expect(workspacesWorkbenchLayoutSource).toContain('<div class="workspace-workbench-body h-full">');
    expect(workspacesWorkbenchLayoutSource).toContain("min-block-size: 0;");
  });
});
