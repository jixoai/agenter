## 1. OpenSpec And Durable Law

- [x] 1.1 Add the `terminal-font-loading-law` delta spec and update proposal/design with the Resource Timing evidence model
- [x] 1.2 Sync durable specs so terminal font loading is owned by terminal-view rather than implied by WebUI CSS

## 2. Terminal Font Loader Implementation

- [x] 2.1 Add a terminal-owned font asset registry inside `@agenter/terminal-view` for `System Mono`, `JetBrains Mono`, and `IBM Plex Mono`
- [x] 2.2 Implement one shared browser font loader that injects font assets once, dedupes repeated loads, and exposes readiness by font profile
- [x] 2.3 Update `terminal-view` and renderer adapters so font settle always runs through the shared loader before adapter-local remeasure / repaint
- [x] 2.4 Keep the default durable font stack renderer-safe while making optional webfonts explicitly terminal-owned assets
- [x] 2.5 Extract one shared terminal font catalog so loader rules and host config UI stop duplicating font family truth
- [x] 2.6 Keep the WebUI dev host from prebundling `@agenter/terminal-view`, so workspace export changes do not surface as false terminal-route 500s

## 3. Tests And Evidence

- [x] 3.1 Add unit coverage for font registry parsing, one-time injection, and load dedupe
- [x] 3.2 Update renderer adapter tests to assert terminal-owned font preparation before settle
- [x] 3.3 Add browser regression coverage that switches terminal font and verifies Resource Timing plus `document.fonts` plus terminal-view settle facts
- [x] 3.4 Expand the terminal font catalog with additional mainstream programming fonts and prove at least one new family through the host config surface
- [x] 3.5 Add a configuration-level regression test that keeps `@agenter/terminal-view` out of WebUI optimizeDeps prebundling
