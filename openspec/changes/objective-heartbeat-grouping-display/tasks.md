## 1. Heartbeat ledger truth

- [ ] 1.1 Persist assistant thinking/text as ordered response segments instead of one flattened assistant snapshot
- [ ] 1.2 Project grouped Heartbeat facts by payload-equivalent auxiliary truth and keep compact-specific prompt facts attached to the compact call
- [ ] 1.3 Add backend/unit coverage for segmented assistant responses, compact grouping, and cold-restore response ids

## 2. Heartbeat surface rendering

- [ ] 2.1 Render compact cycles as one special Heartbeat card with compact/detailed disclosure modes
- [ ] 2.2 Show running tool intent and parameters before completion, then upgrade the same row in place on result/error
- [ ] 2.3 Keep the top-of-stream paging loader and latest-row stability attached to the same Heartbeat surface while grouped history mutates

## 3. Verification and follow-through

- [ ] 3.1 Add or update Storybook/DOM coverage for compact-card rendering, running tool params, older-page loading, and latest-row stability
- [ ] 3.2 Run targeted app-server and WebUI tests for the grouped Heartbeat path
- [ ] 3.3 Sync affected durable specs before archiving
