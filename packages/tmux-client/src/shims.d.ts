declare module "bun:test" {
  interface Expectation<T> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toBeInstanceOf(expected: Function): void;
    toThrow(expected?: string): void;
    toBeNull(): void;
    toHaveLength(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    readonly resolves: {
      toBe(expected: Awaited<T>): Promise<void>;
      toEqual(expected: unknown): Promise<void>;
      toBeNull(): Promise<void>;
      toHaveLength(expected: number): Promise<void>;
      toBeGreaterThanOrEqual(expected: number): Promise<void>;
    };
    readonly rejects: {
      toThrow(expected?: string): Promise<void>;
      toBeInstanceOf(expected: Function): Promise<void>;
    };
  }

  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const describe: (name: string, fn: () => void) => void;
  export const expect: <T = unknown>(value: T) => Expectation<T>;
  export const test: (name: string, fn: () => void | Promise<void>, timeout?: number) => void;
}

declare module "node:fs" {
  export const mkdtempSync: (prefix: string) => string;
  export const readFileSync: (path: string, encoding: "utf8") => string;
  export const rmSync: (path: string, options?: { recursive?: boolean; force?: boolean }) => void;
}

declare module "node:os" {
  export const tmpdir: () => string;
}

declare module "node:path" {
  export const join: (...parts: string[]) => string;
}

declare const Bun: {
  spawn: (
    command: readonly string[],
    options: { env?: Record<string, string | undefined>; stdout: "pipe"; stderr: "pipe" },
  ) => {
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
    exited: Promise<number>;
  };
  which: (executable: string) => string | null;
};
