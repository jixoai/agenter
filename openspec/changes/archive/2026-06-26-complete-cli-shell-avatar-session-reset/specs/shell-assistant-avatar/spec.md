> Boundary note:
> This delta still captures the important rule that room-bound terminal work must stay terminal-local.
> But cli-shell terminal identity now follows the bound TerminalSystem terminal, not “current opened terminal” or any `terminal-1/terminal-2` ontology.

## MODIFIED Requirements

### Requirement: Shell-assistant SHALL keep guard approval terminal-local in cli-shell

The default shell-assistant prompt guidance SHALL keep cli-shell MessageRoom work focused on the bound TerminalSystem terminal. Guard approval, denial, expiry, and timeout SHALL be treated as terminal-local authorization outcomes rather than reasons to perform equivalent bound-terminal work through another execution surface.

#### Scenario: Shell-assistant targets the bound terminal
- **WHEN** shell-assistant handles a cli-shell MessageRoom request to run, type, inspect, or continue terminal work
- **THEN** it treats the bound TerminalSystem terminal as the target
- **AND** if implementation-internal terminals exist, the prompt keeps them out of the default conversation model
- **AND** it does not satisfy that bound-terminal request by running an equivalent command in `root_bash` or `workspace_bash`

#### Scenario: Guard approval remains terminal-local
- **WHEN** shell-assistant receives a guard approval request from TerminalSystem
- **THEN** the prompt guidance treats it as pending work on the bound terminal
- **AND** denial, expiry, or timeout does not authorize the Avatar to perform the same bound-terminal action through another execution surface
