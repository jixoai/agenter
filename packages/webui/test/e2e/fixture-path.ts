import { join } from "node:path";
import { tmpdir } from "node:os";

export const E2E_FIXTURE_PATH = join(tmpdir(), "agenter-webui-playwright-fixture.json");
