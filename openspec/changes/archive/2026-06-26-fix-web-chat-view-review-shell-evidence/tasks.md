## 1. BDD Red

- [x] 1.1 Add failing BDD for review-shell visible text so Framework7 icon implementation names do not leak as user text.
- [x] 1.2 Add failing BDD for iPhone child-page stability so source detail owns the active viewport and root tabbar is suspended.
- [x] 1.3 Add failing BDD for resource overlay entrypoints so inline tokens and aggregated resource tiles have stable accessible activation paths.
- [x] 1.4 Review A: map every failing BDD scenario back to one original report finding before implementation.

## 2. Implementation

- [x] 2.1 Fix Framework7 icon/resource loading or markup so icon glyph names are not visible as text.
- [x] 2.2 Fix mobile child route/page state so source detail is a complete Framework7 child page on iPhone 14.
- [x] 2.3 Fix inline-token and resource-tile activation labels used by overlay screenshot automation.
- [x] 2.4 Review B: self-review implementation against Framework7 ownership law and room/source/domain app direction.

## 3. Verification And Evidence

- [x] 3.1 Run targeted `@agenter/web-chat-view` unit/DOM BDD for the repaired contracts.
- [x] 3.2 Run the real example screenshot scripts for desktop and iPhone 14 states.
- [x] 3.3 Generate a fresh HTML report with same-run screenshots and plain-language findings.
- [x] 3.4 Review C: compare the final report against original defects and document any remaining risks.

## Self Review Notes

- Review B: The implementation keeps Framework7 as the shell owner. It uses `Toolbar`/`ToolbarPane` for root navigation, route-owned `Page` for child surfaces, and stable accessible resource entrypoints instead of a private overlay/navigation system.
- Review B: The route-open check now uses current route/current page evidence instead of stale router history, because history is only a projection and was the source of the child-page drift.
- Review C: The final report references screenshots from `.screenshot/after/fix-review-shell-evidence-20260528-final` only. The visible defects from the prior report are covered: icon implementation text is absent, iPhone child pages are complete, and token/tile resource previews open through stable labels.
- Review C: Remaining risks stay explicit: full room-management/message-system decoupling is outside this change, Browser plugin `iab` was unavailable in this run, and Safari real-device validation was not run.
