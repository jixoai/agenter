## 1. OpenSpec and law update

- [x] 1.1 Add delta specs for exact local delivery host binding law
- [x] 1.2 Confirm the law treats host and port as part of the same room-visible contract

## 2. Runtime skill implementation

- [x] 2.1 Strengthen runtime built-in skills so exact URL verification forbids `localhost` / `[::1]` fallback when the promised host is `127.0.0.1`
- [x] 2.2 Add explicit bind examples for common local HTTP service commands

## 3. Validation

- [x] 3.1 Update runtime skill regression coverage for exact host binding guidance
- [x] 3.2 Re-run the real AI room-terminal delivery validation and confirm the Avatar no longer substitutes alternate localhost hosts for the promised URL
