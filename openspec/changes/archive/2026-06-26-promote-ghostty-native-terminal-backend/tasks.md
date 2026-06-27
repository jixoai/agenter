## 1. OpenSpec projection law

- [x] 1.1 Add delta specs for runtime terminal config/list projection, runtime JSON descriptor backend schema, and terminal control-plane backend truth carry-through.
- [x] 1.2 Validate `promote-ghostty-native-terminal-backend` in strict mode before implementation sign-off.

## 2. App-server backend projection

- [x] 2.1 Thread `backend` through app-kernel global terminal create/set-config contracts and runtime-local handler typings.
- [x] 2.2 Expose `backend` from runtime terminal view/config projections, including remote placeholder terminal projection.
- [x] 2.3 Extend browser-authenticated terminal create/set-config schemas to accept the shared backend enum.

## 3. Verification

- [x] 3.1 Update or add focused app-server tests for backend-bearing terminal projections and constructor compatibility.
- [x] 3.2 Run targeted app-server tests and type checks covering the touched terminal surfaces.
- [x] 3.3 Run `bun agenter shell --backend=ghostty-native` as a regression walkthrough after the app-server changes land.
