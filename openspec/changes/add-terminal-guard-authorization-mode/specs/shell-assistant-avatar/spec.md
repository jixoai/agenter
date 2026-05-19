## ADDED Requirements

### Requirement: Shell-assistant SHALL treat guard approval as terminal-local pending work

The default shell-assistant prompt SHALL teach that guard approval belongs to the current cli-shell TerminalSystem instance. When terminal write/input returns an approval request, shell-assistant SHALL report or wait for that approval instead of executing an equivalent command in a non-visible shell.

#### Scenario: Guard approval is not a root workspace fallback
- **WHEN** shell-assistant attempts a terminal action and receives an approval request
- **THEN** it treats the action as waiting for administrator approval on the current TerminalSystem instance
- **THEN** it does not run the same command through `root_bash` or `workspace_bash` and present that as if it happened in the user's visible terminal

#### Scenario: Guard approval can be reported to the room
- **WHEN** a guard approval request is created for a user-requested terminal action
- **THEN** shell-assistant may send a concise room-visible update that the terminal action is waiting for approval
- **THEN** the update includes enough context for the user or admin to recognize the requested terminal action

#### Scenario: Denied or expired approval is not retried through another shell
- **WHEN** a guard approval request for a visible terminal action is denied or expires
- **THEN** shell-assistant treats the terminal action as not performed
- **THEN** it may report the denial or expiry in the current MessageRoom
- **THEN** it does not run the same command through `root_bash` or `workspace_bash` and present that as terminal progress

#### Scenario: Repeated pending approval is not a prompt loop
- **WHEN** shell-assistant receives an approval request for an action that is already pending
- **THEN** it treats the existing request as the current blocker
- **THEN** it does not repeatedly re-submit equivalent terminal writes only to create more permission prompts

#### Scenario: Approved guard approval resumes through TerminalSystem
- **WHEN** a guard approval request for a current cli-shell terminal action is approved
- **THEN** shell-assistant continues the requested work through the same TerminalSystem terminal
- **THEN** it observes the terminal result before reporting completion in the current MessageRoom
- **THEN** it does not run the approved terminal action through `root_bash` or `workspace_bash` as a substitute

#### Scenario: Hosting attention does not change terminal authority
- **WHEN** cli-shell managed/takeover hosting attention is active for the current shell
- **THEN** shell-assistant treats the current cli-shell MessageRoom conversation as about the bound TerminalSystem instance
- **THEN** shell-assistant still writes only through terminal APIs under its existing TerminalSystem authority
- **THEN** if that authority is Guard and no active terminal write lease exists, shell-assistant waits/reports on guard approval rather than treating hosting as write permission
