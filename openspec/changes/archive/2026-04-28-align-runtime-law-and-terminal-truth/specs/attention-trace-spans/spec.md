## MODIFIED Requirements

### Requirement: Attention trace spans SHALL preserve downstream causal links
Attention trace spans SHALL keep enough causal links for downstream tool calls, delivery dispatches, receipts, and explicit system mutations to point back to the same attention work.

#### Scenario: Downstream effects link back to attention work
- **WHEN** an attention-driven cycle starts model work and later performs tools or explicit system mutations
- **THEN** downstream spans can link back to the originating attention refs and model-call refs
- **AND** trace inspection does not depend on a hidden output-routing span category
