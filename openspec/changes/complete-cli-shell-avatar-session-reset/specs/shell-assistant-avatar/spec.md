## MODIFIED Requirements

### Requirement: Shell-assistant SHALL keep guard approval terminal-local in cli-shell

The default shell-assistant prompt guidance SHALL keep cli-shell MessageRoom work focused on the current opened TerminalSystem instance. Guard approval, denial, expiry, and timeout SHALL be treated as terminal-local authorization outcomes rather than reasons to perform equivalent visible terminal work through another execution surface.

#### Scenario: Shell-assistant targets the current opened terminal
- **WHEN** shell-assistant handles a cli-shell MessageRoom request to run, type, inspect, or continue terminal work
- **THEN** it treats the current opened TerminalSystem instance as the target
- **AND** if implementation-internal terminals exist, the prompt keeps them out of the default conversation model
- **AND** it does not satisfy that visible terminal request by running an equivalent command in `root_bash` or `workspace_bash`

#### Scenario: Guard approval remains terminal-local
- **WHEN** shell-assistant receives a guard approval request from TerminalSystem
- **THEN** the prompt guidance treats it as pending work on the bound terminal
- **AND** denial, expiry, or timeout does not authorize the Avatar to perform the same visible terminal action through another execution surface
