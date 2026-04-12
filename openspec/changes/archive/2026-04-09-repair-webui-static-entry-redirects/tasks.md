## 1. Redirect law repair

- [x] 1.1 Replace redirect-only WebUI entry `+page.server.ts` files with CSR-compatible route modules that preserve the same canonical destinations
- [x] 1.2 Ensure the runtime entry redirect preserves `sessionId` when routing to the canonical attention tab

## 2. Regression protection

- [x] 2.1 Update redirect route contract tests to encode the static CSR law and forbid server-only redirect entry files
- [x] 2.2 Add or update targeted verification so default static entry hydration fails if HTML is returned where client redirect routing expects CSR behavior

## 3. Walkthrough

- [x] 3.1 Rebuild WebUI and re-run the default `agenter web` desktop walkthrough for `/`, `/messages/room/:chatId?sessionId=:sessionId`, and `/avatars/runtime/:sessionId/attention`
- [x] 3.2 Re-run the same walkthrough on iPhone 14 viewport and confirm the browser no longer hits the HTML-as-JSON redirect failure
