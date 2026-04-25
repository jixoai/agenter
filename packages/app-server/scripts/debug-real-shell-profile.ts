import { REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE } from "../test-support/real-ai-test-personas";
import { createRealKernelHarness } from "../test-support/real-kernel-harness";
import {
  projectRealShellProfileResult,
  runRealShellProfileScenario,
} from "../test-support/real-shell-profile-scenario";

const main = async (): Promise<void> => {
  const harness = await createRealKernelHarness({
    sessionName: "debug-real-shell-profile",
    avatarNickname: REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE.nickname,
    agenterPromptContent: REAL_SHELL_PROFILE_AUDIT_AVATAR_PROFILE.prompt,
    logger: {
      log: (line) => {
        if (line.level === "warn" || line.level === "error") {
          console.error(`[${line.level}] ${line.message}`, line.meta ?? {});
        }
      },
    },
  });

  if (!harness) {
    throw new Error("Real AI config not found.");
  }

  try {
    const result = await runRealShellProfileScenario(harness);
    console.log(JSON.stringify(projectRealShellProfileResult(result), null, 2));
  } finally {
    await harness.stop();
  }
};

await main();
