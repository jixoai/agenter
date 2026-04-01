# quickstart-workspace-bootstrap Specification

## Purpose
Define the workspace-local bootstrap defaults that Quick Start edits before a new AvatarSession is created.

## Requirements

### Requirement: Quick Start SHALL support workspace-local chat and terminal bootstrap config

Quick Start MUST provide admin controls to edit chat-main metadata defaults and boot terminal descriptors before session creation.

#### Scenario: Room config edits persist to workspace-local settings
- **WHEN** user edits quickstart room config and confirms
- **THEN** workspace local settings layer is updated
- **AND** next created session reads those defaults during startup

#### Scenario: Terminal chips model boot terminal descriptors
- **WHEN** user adds, edits, or removes quickstart terminal chips
- **THEN** descriptors are persisted to workspace local settings
- **AND** next created session boots terminals according to descriptors

### Requirement: Quick Start room bootstrap SHALL persist seat membership without legacy identity roles
Quick Start room bootstrap settings SHALL persist participant ids and optional labels, and SHALL stop emitting deprecated `avatar|user|system` identity-role markers.

#### Scenario: Saving quickstart room config strips legacy participant roles
- **WHEN** the user saves Quick Start room config
- **THEN** the stored participant list keeps seat ids and optional labels
- **AND** deprecated identity-role fields are omitted from the normalized write
