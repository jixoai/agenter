declare module "upng-js";
declare module "gifenc";

declare global {
  var Bun:
    | {
        spawn(
          argv: string[],
          options: {
            cwd?: string;
            env?: Record<string, string>;
            terminal: {
              cols: number;
              rows: number;
              data: (_terminal: unknown, data: Uint8Array) => void;
            };
          },
        ): {
          terminal: {
            write(data: string): void;
            close(): void;
            resize(cols: number, rows: number): void;
          };
          kill(signal?: number): void;
          exitCode: number | null;
          exited: Promise<number>;
          pid: number;
        };
      }
    | undefined;
}

export {};
