# User Review Loop: Framework7, Avatar Auth Identity, Heartbeat Rows

## User Findings

- Framework7 page architecture and routing did not follow the intended Framework7 app law. Page transition animation was missing, button styling was over-customized, and page content did not use the correct Page header/content/footer organization, so safe-area behavior was not reliable.
- Avatar display looked wrong, likely because the example was not correctly using the authSystem-backed Avatar identity.
- Heartbeat pages were all empty, which required investigation.

## Corrections

- The example shell now uses Framework7 `View` routes for `/heartbeat/:runtimeId` instead of manually calling `history.pushState` and conditionally replacing one page.
- Directory and detail pages use Framework7 `Page`, `Navbar`, `PageContent`, `List`, `ListInput`, and `ListItem` primitives.
- Avatar rows and the Heartbeat identity header render the authSystem-provided `iconUrl` / `avatarPrincipalId` from the global Avatar catalog instead of passing initials through the ListItem media prop.
- The connection adapter carries `avatarPrincipalId` through the Heartbeat target identity.
- Loaded-empty Heartbeat now exposes explicit backend evidence: the current Agenter target returned zero grouped Heartbeat rows for that session.
- The configable statusbar sheet was restyled so mobile config actions render as a clean bottom sheet instead of falling back to browser-default button styling.

## Backend Evidence

The local daemon at `127.0.0.1:4590` returned auth-backed Avatar catalog rows with principal IDs and icon URLs. It also returned four stopped sessions (`default`, `architect`, `jane`, `relay-bot`) with `0` grouped Heartbeat rows each. The empty Heartbeat pages were therefore not caused by a missing frontend merge path in this local daemon state, but the UI needed to show that evidence explicitly.
