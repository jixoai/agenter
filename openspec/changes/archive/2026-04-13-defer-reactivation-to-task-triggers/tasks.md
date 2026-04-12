## 1. Closure

- [x] 1.1 Record that this proposal is superseded by the later `focused | background | muted` + notification wake law.
- [x] 1.2 Keep durable specs on the adopted law: `focused` and `background` stay wakeable, `muted` is silent by default, and notification-class push overrides mute.
- [x] 1.3 Archive this change without syncing its obsolete delta specs into the main scheduling contract.

## Superseded implementation plan

The original auto-wake removal / task-trigger reactivation plan was intentionally not implemented, because the later clarified architecture chose a different law:

1. `score > 0` remains wakeable for `focused` and `background` contexts.
2. `muted` suppresses default wake-up.
3. Notification-class attention ingress is the explicit force-wake path.
