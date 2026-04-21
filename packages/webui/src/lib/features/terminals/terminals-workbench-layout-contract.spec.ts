import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const terminalsWorkbenchLayoutSource = readFileSync(
  resolve(import.meta.dirname, "terminals-workbench-layout.svelte"),
  "utf8",
);

describe("Feature: Terminals shell toolbar contract", () => {
  test("Scenario: Given the terminals shell summary toolbar follows the shared page-toolbar law When reading the source Then the shell binds identity and status through the shared primitive instead of the legacy meta compat slot", () => {
    expect(terminalsWorkbenchLayoutSource).toContain("WorkbenchToolbarStatus");
    expect(terminalsWorkbenchLayoutSource).toContain("identityLeading={terminalsToolbarIdentityLeading}");
    expect(terminalsWorkbenchLayoutSource).toContain("identityTitle={terminalsToolbarIdentityTitle}");
    expect(terminalsWorkbenchLayoutSource).toContain("identitySubtitle={terminalsToolbarIdentitySubtitle}");
    expect(terminalsWorkbenchLayoutSource).toContain("status={terminalsToolbarStatus}");
    expect(terminalsWorkbenchLayoutSource).not.toContain("meta={terminalsToolbarMeta}");
  });
});
