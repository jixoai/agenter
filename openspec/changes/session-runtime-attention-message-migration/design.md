## Decisions

### Session runtime owns adapters, not business models
SessionRuntime hosts the native attention system, terminal control plane, and message control plane. It only wires them together through LoopBus adapters.

### Native attention tools
Old V1 tools are removed. The runtime exposes:
- `attention_context_list`
- `attention_query`
- `attention_item_append`
- `attention_item_patch`

### Message ingress
Incoming chat-channel messages create attention items in the channel-bound context.

### Message egress
Committed attention items with a message reply target call `messageSystem.reply(...)` through a LoopBus egress adapter.

### Stop vs abort
- `stop`: abort current model call and stop LoopBus work, keep systems alive
- `abort`: includes stop, then destroys runtime-owned systems and transports
