import { z } from "zod";

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("instance.list"), requestId: z.string().optional() }),
  z.object({
    type: z.literal("instance.create"),
    requestId: z.string().optional(),
    payload: z.object({
      name: z.string().optional(),
      cwd: z.string().min(1),
      autoStart: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal("instance.update"),
    requestId: z.string().optional(),
    payload: z.object({
      instanceId: z.string().min(1),
      name: z.string().optional(),
      autoStart: z.boolean().optional(),
    }),
  }),
  z.object({
    type: z.literal("instance.delete"),
    requestId: z.string().optional(),
    payload: z.object({ instanceId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("instance.start"),
    requestId: z.string().optional(),
    payload: z.object({ instanceId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("instance.stop"),
    requestId: z.string().optional(),
    payload: z.object({ instanceId: z.string().min(1) }),
  }),
  z.object({
    type: z.literal("instance.focusTerminal"),
    requestId: z.string().optional(),
    payload: z.object({
      instanceId: z.string().min(1),
      terminalId: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("chat.send"),
    requestId: z.string().optional(),
    payload: z.object({
      instanceId: z.string().min(1),
      text: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal("settings.read"),
    requestId: z.string().optional(),
    payload: z.object({
      instanceId: z.string().min(1),
      kind: z.enum(["settings", "agenter", "system", "template", "contract"]),
    }),
  }),
  z.object({
    type: z.literal("settings.save"),
    requestId: z.string().optional(),
    payload: z.object({
      instanceId: z.string().min(1),
      kind: z.enum(["settings", "agenter", "system", "template", "contract"]),
      content: z.string(),
      baseMtimeMs: z.number().nonnegative(),
    }),
  }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface DaemonAck {
  type: "ack";
  requestId?: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface DaemonEvent<TPayload = unknown> {
  type: string;
  timestamp: number;
  payload: TPayload;
}

export const encodeMessage = (value: unknown): string => JSON.stringify(value);

export const parseClientMessage = (raw: string): ClientMessage => {
  const parsed = JSON.parse(raw) as unknown;
  return clientMessageSchema.parse(parsed);
};
