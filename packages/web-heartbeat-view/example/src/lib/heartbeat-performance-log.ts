const prefix = "[web-heartbeat-view:perf]";

type LogFields = Record<string, boolean | number | string | null | undefined>;
type LogEnd = (endFields?: LogFields) => void;

const now = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

const cleanFields = (fields: LogFields): LogFields =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

const print = (event: string, fields: LogFields): void => {
  console.info(prefix, event, JSON.stringify(cleanFields(fields)));
};

export const heartbeatPerfLog = {
  mark(event: string, fields: LogFields = {}): void {
    print(event, fields);
  },
  start(event: string, fields: LogFields = {}): LogEnd {
    const startedAt = now();
    print(`${event}:start`, fields);
    return (endFields: LogFields = {}) => {
      print(
        `${event}:end`,
        {
          ...fields,
          ...endFields,
          durationMs: Math.round(now() - startedAt),
        },
      );
    };
  },
  error(event: string, error: unknown, fields: LogFields = {}): void {
    print(
      `${event}:error`,
      {
        ...fields,
        message: error instanceof Error ? error.message : String(error),
      },
    );
  },
};
