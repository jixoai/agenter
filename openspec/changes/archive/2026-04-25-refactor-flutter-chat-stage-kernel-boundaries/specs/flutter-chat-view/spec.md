## ADDED Requirements

### Requirement: Flutter chat view SHALL isolate room IO from the stage state kernel

The Flutter chat view package SHALL keep websocket transport and room asset upload behind explicit package-owned boundaries. `ChatViewController` SHALL remain the host-facing stage state kernel/view-model and SHALL not require feature code to couple directly to websocket or HTTP implementations. Default package adapters SHALL preserve the existing canonical room transport and asset upload behavior.

#### Scenario: Controller connects through an injected room transport
- **WHEN** a host or test creates a controller with a room transport adapter
- **THEN** the controller uses that adapter for connect, frame writes, incoming events, and close
- **THEN** the observable state transitions remain equivalent to the canonical websocket flow

#### Scenario: Attachment upload uses an injected room asset uploader
- **WHEN** a draft contains pending files and a non-empty room access token
- **THEN** the controller delegates upload to the package room asset uploader boundary
- **THEN** the websocket `send` frame contains only server-returned attachment metadata

### Requirement: Flutter chat view SHALL treat protocol codec behavior as a platform law

The Flutter chat view package SHALL centralize room transport frame parsing and encoding in a protocol codec boundary. Malformed payloads and unsupported event types SHALL fail as protocol facts that can be tested independently from widgets and product-shell code.

#### Scenario: Malformed transport payload is rejected by the codec
- **WHEN** an incoming websocket frame is not a valid room transport event object
- **THEN** protocol decoding fails with a structured parse error
- **THEN** no widget or host shell logic is required to identify the malformed frame

### Requirement: Flutter chat stage SHALL compose from smaller semantic primitives

The public `FlutterChatView` SHALL remain the package stage entrypoint, but its implementation SHALL compose transcript viewport, stage notices, composer surface, and row primitives instead of concentrating all stage behavior in one widget body.

#### Scenario: Host embeds the same stage entrypoint after refactor
- **WHEN** the product shell embeds `FlutterChatView`
- **THEN** the host-owned profile/navigation/detail chrome remains outside the package
- **THEN** transcript, notices, composer, and row affordances still render through package-owned stage primitives

### Requirement: Flutter chat stage SHALL avoid Web platform views during transcript motion

The Flutter chat stage and standalone Web demo shell SHALL not mount `SelectableRegion`, `HtmlElementView`, or Flutter Web platform views for message body selection. Copy affordances SHALL be stable actions so virtualized transcript rows and return-to-latest motion cannot leave `_PlatformViewPlaceholderBox` callbacks attached to disposed render objects.

#### Scenario: Return-to-latest is stable on Flutter Web WASM
- **WHEN** an operator scrolls away from latest messages in the Web demo shell
- **THEN** activating the return-to-latest affordance does not emit detached render-object assertions
- **THEN** the DOM contains no message-selection Flutter platform views
