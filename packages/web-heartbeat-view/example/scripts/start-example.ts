import net from "node:net";

const preferredPort = Number(process.env.PORT ?? process.env.WEB_HEARTBEAT_VIEW_PORT ?? "4179");
const host = process.env.HOST ?? "127.0.0.1";
const exampleRoot = import.meta.dirname.replace(/\/scripts$/u, "");

const isPortAvailable = async (port: number): Promise<boolean> => {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => {
      resolve(false);
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
};

const pickAvailablePort = async (port: number): Promise<number> => {
  for (let candidate = port; candidate < port + 100; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      return candidate;
    }
  }
  throw new Error(`unable to find an available port near ${port}`);
};

const port = await pickAvailablePort(preferredPort);

const proc = Bun.spawn({
  cmd: ["bun", "run", "dev", "--", "--host", host, "--port", String(port)],
  cwd: exampleRoot,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

console.log(`web-heartbeat-view example: http://${host}:${port}`);

const exitCode = await proc.exited;
process.exit(exitCode);
