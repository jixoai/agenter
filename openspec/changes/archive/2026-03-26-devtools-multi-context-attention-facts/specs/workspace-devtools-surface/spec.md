## MODIFIED Requirements

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect session cycles and related factual inputs or internal assistant records without requiring those facts to appear in the default Chat flow.

#### Scenario: Multi-context attention facts preserve context ownership
- **WHEN** a cycle fact contains an `attention-system-active` payload with multiple attention contexts
- **THEN** Devtools renders a readable attention summary that reflects the multi-context payload instead of falling back to an opaque raw dump
- **THEN** each rendered attention item preserves enough ownership metadata to show which context it came from
- **THEN** structured inspection remains available for exact payload review
