## Decisions

### Package responsibility
`web-chat-view` owns chat rendering, message viewport virtualization, composer integration, and client-side chat transport handling.

### WebUI responsibility
WebUI hosts the package, supplies shell chrome, and coordinates route-level selection.

### First transport-backed scope
The first implementation includes:
- channel connection state
- reverse-time history paging
- virtualized message list
- React + CodeMirror composer
- current high-value composer features: `@`, attachments, screenshot, send
