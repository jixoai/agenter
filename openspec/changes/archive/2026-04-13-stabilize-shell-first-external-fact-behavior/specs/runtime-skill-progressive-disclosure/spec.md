## ADDED Requirements

### Requirement: Runtime shell guidance SHALL describe external-network verification as a factual capability
Runtime built-in skill guidance and sibling shell references SHALL state that `root_workspace_bash` can perform outbound network checks for objective fact verification, while keeping the overview concise and overview-first.

#### Scenario: AI learns shell networking without reading a scripted playbook
- **WHEN** the runtime exposes the built-in runtime skill and shell-surface reference
- **THEN** they state that one-shot shell can be used to verify external facts objectively
- **AND** they do not require the overview body to inline a long list of canned query commands

### Requirement: Progressive disclosure SHALL keep persona law in prompts and operational law in skills
Runtime guidance SHALL keep persona and thinking-style bias in `AGENTER.mdx`, while runtime skills and references stay focused on shell/tool capability boundaries and expansion paths.

#### Scenario: External-fact behavior is not duplicated across prompts and skills
- **WHEN** the system teaches Avatar behavior for external-fact tasks
- **THEN** the personality bias lives in `AGENTER.mdx`
- **AND** runtime skill docs focus on how the shell surface works and how to expand deeper references when needed
