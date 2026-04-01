import { startE2EServerHarness } from "./server-harness";

const waitForSignal = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    const onSignal = (): void => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      resolve();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
  });
};

const main = async (): Promise<void> => {
  const harness = await startE2EServerHarness();

  console.log(`playwright e2e ui: ${harness.baseUrl}`);

  try {
    await waitForSignal();
  } finally {
    await harness.stop();
  }
};

await main();
