# Reverse-Flow Conversation Trace Report

- baseline: `HEAD 33bf9f7c207e`
- candidate: working tree `/Users/kzf/.codex/worktrees/ac5b/agenter`
- raw traces (comparison): `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-04-11-728Z`
- raw traces (input evidence): `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-12-05-830Z`
- harness mode: production Vite build + Chromium trace capture

## Summary

| Viewport | Scenario | Busy ms | Script ms | Layout ms | GC ms | Long tasks |
| --- | --- | --- | --- | --- | --- | --- |
| desktop-chromium | Heartbeat initial open | 58.42 -> 15.64 (-42.78) | 4.88 -> 3.81 (-1.07) | 0 -> 0 (0) | 4.75 -> 0 (-4.75) | 0 -> 0 |
| mobile-iphone14 | Heartbeat initial open | 78.19 -> 82.64 (+4.45) | 53.01 -> 55.91 (+2.9) | 7.6 -> 7.56 (-0.04) | 1.96 -> 1.77 (-0.19) | 0 -> 0 |
| desktop-chromium | Heartbeat load older | 290.53 -> 367.95 (+77.42) | 283.23 -> 400.17 (+116.94) | 23.43 -> 30.71 (+7.28) | 4.51 -> 7.98 (+3.47) | 0 -> 0 |
| mobile-iphone14 | Heartbeat load older | 298.11 -> 294.7 (-3.41) | 296.48 -> 311.24 (+14.76) | 23.65 -> 24.23 (+0.58) | 5.57 -> 3.53 (-2.04) | 0 -> 0 |
| desktop-chromium | Heartbeat latest append | 115.84 -> 116.62 (+0.78) | 80.56 -> 83.63 (+3.07) | 8.85 -> 8.29 (-0.56) | 1.81 -> 1.7 (-0.11) | 0 -> 0 |
| mobile-iphone14 | Heartbeat latest append | 111.2 -> 125.43 (+14.23) | 85.51 -> 102.54 (+17.03) | 9.01 -> 10.71 (+1.7) | 1.71 -> 1.89 (+0.18) | 0 -> 0 |
| desktop-chromium | Heartbeat latest growth | 22.84 -> 22.24 (-0.6) | 11.61 -> 11.64 (+0.03) | 0.87 -> 0.74 (-0.13) | 0 -> 0 (0) | 0 -> 0 |
| mobile-iphone14 | Heartbeat latest growth | 21.95 -> 28.67 (+6.72) | 10.95 -> 14.33 (+3.38) | 0.84 -> 1.17 (+0.33) | 0 -> 0 (0) | 0 -> 0 |
| desktop-chromium | Room chat initial open | 29.12 -> 27.41 (-1.71) | 15.21 -> 18.4 (+3.19) | 4.2 -> 3.77 (-0.43) | 0 -> 0 (0) | 0 -> 0 |
| mobile-iphone14 | Room chat initial open | 41.77 -> 14.08 (-27.69) | 12.7 -> 4.32 (-8.38) | 3.63 -> 0 (-3.63) | 4.45 -> 0 (-4.45) | 0 -> 0 |
| desktop-chromium | Room chat load older | 327.49 -> 422.53 (+95.04) | 321.26 -> 438.31 (+117.05) | 41.49 -> 52.63 (+11.14) | 5.58 -> 8.82 (+3.24) | 2 -> 4 |
| mobile-iphone14 | Room chat load older | 325.88 -> 445.75 (+119.87) | 344.14 -> 496.64 (+152.5) | 43.35 -> 59.53 (+16.18) | 5.6 -> 5.26 (-0.34) | 4 -> 4 |
| desktop-chromium | Room chat append while pinned | 110.07 -> 140.72 (+30.65) | 69.83 -> 76.96 (+7.13) | 14.46 -> 17.04 (+2.58) | 2.05 -> 4 (+1.95) | 0 -> 0 |
| mobile-iphone14 | Room chat append while pinned | 100.82 -> 96.98 (-3.84) | 77.89 -> 66.81 (-11.08) | 14.12 -> 13.12 (-1) | 2.49 -> 0 (-2.49) | 0 -> 0 |
| desktop-chromium | Room chat append while away | 95.39 -> 85.66 (-9.73) | 63.65 -> 59.95 (-3.7) | 15.43 -> 13.43 (-2) | 0 -> 0 (0) | 0 -> 0 |
| mobile-iphone14 | Room chat append while away | 123.67 -> 91.02 (-32.65) | 90.57 -> 58.31 (-32.26) | 18.65 -> 13.19 (-5.46) | 1.74 -> 2.7 (+0.96) | 0 -> 0 |

## Conclusions

- Heartbeat reverse-flow removes the worst open/load-older churn. Initial open busy ms: desktop 58.42 -> 15.64 (-42.78); mobile 78.19 -> 82.64 (+4.45). Load older busy ms: desktop 290.53 -> 367.95 (+77.42); mobile 298.11 -> 294.7 (-3.41).
- Heartbeat append remains the residual hotspot: latest append busy ms regressed to desktop 115.84 -> 116.62 (+0.78); mobile 111.2 -> 125.43 (+14.23), while latest growth stayed flat-to-better at desktop 22.84 -> 22.24 (-0.6); mobile 21.95 -> 28.67 (+6.72). This isolates cost to newest-row insertion rather than post-measure growth.
- Room chat initial open improved materially, but older paging did not: initial open busy ms moved to desktop 29.12 -> 27.41 (-1.71); mobile 41.77 -> 14.08 (-27.69), while load older moved to desktop 327.49 -> 422.53 (+95.04); mobile 325.88 -> 445.75 (+119.87).
- Room chat append paths are the clearest remaining regression. Pinned append busy ms: desktop 110.07 -> 140.72 (+30.65); mobile 100.82 -> 96.98 (-3.84). Away-from-latest append busy ms: desktop 95.39 -> 85.66 (-9.73); mobile 123.67 -> 91.02 (-32.65). Trace tops shift toward RunMicrotasks / FunctionCall / Layout, which points at message merge and row-render churn rather than old scrollHeight polling.
- Next radar: Heartbeat append and all room-chat append/load-older scenarios still need dense-list renderer tiering or lighter row surfaces. Reverse-flow fixed the scroll-management law, but it did not remove heavy renderer work when new rows enter the transcript.

## Top Renderer Events

### Heartbeat initial open

- desktop-chromium: before [RunTask 29.3ms, ThreadControllerImpl::RunTask 29.13ms, Receive mojo message 10.39ms, MajorGC 4.75ms, EvaluateScript 4.72ms, V8.GC_MARK_COMPACTOR 4.67ms, V8.GC_MC_INCREMENTAL_START 3.55ms, V8.GC_MC_INCREMENTAL 3.44ms] / after [RunTask 7.85ms, ThreadControllerImpl::RunTask 7.79ms, Receive mojo message 6.93ms, EvaluateScript 3.75ms, Paint 0.36ms, Layerize 0.15ms, PrePaint 0.13ms, RunMicrotasks 0.06ms]
- mobile-iphone14: before [RunTask 39.23ms, ThreadControllerImpl::RunTask 38.96ms, FireAnimationFrame 18.01ms, RunMicrotasks 17.62ms, FunctionCall 12.79ms, Receive mojo message 8.12ms, Layout 5.69ms, EvaluateScript 4.58ms] / after [RunTask 41.47ms, ThreadControllerImpl::RunTask 41.17ms, FireAnimationFrame 18.92ms, RunMicrotasks 18.09ms, FunctionCall 14.34ms, Receive mojo message 8.14ms, Layout 5.74ms, EvaluateScript 4.55ms]

### Heartbeat load older

- desktop-chromium: before [RunTask 145.53ms, ThreadControllerImpl::RunTask 145ms, RunMicrotasks 96.95ms, FireAnimationFrame 87.77ms, FunctionCall 79.18ms, Receive mojo message 23.68ms, EventDispatch 14.74ms, Layout 12.39ms] / after [RunTask 184.16ms, ThreadControllerImpl::RunTask 183.79ms, RunMicrotasks 142.72ms, FireAnimationFrame 123.29ms, FunctionCall 114.28ms, Receive mojo message 27.39ms, Layout 17.72ms, EventDispatch 16.1ms]
- mobile-iphone14: before [RunTask 149.33ms, ThreadControllerImpl::RunTask 148.77ms, RunMicrotasks 106.05ms, FireAnimationFrame 93.93ms, FunctionCall 79.63ms, Receive mojo message 23.33ms, Layout 13.12ms, EventDispatch 12.08ms] / after [RunTask 147.66ms, ThreadControllerImpl::RunTask 147.04ms, RunMicrotasks 110.9ms, FireAnimationFrame 92.66ms, FunctionCall 88.88ms, Receive mojo message 26.64ms, Layout 14.27ms, EventDispatch 13.49ms]

### Heartbeat latest append

- desktop-chromium: before [RunTask 58ms, ThreadControllerImpl::RunTask 57.85ms, RunMicrotasks 45.89ms, Receive mojo message 45.2ms, FunctionCall 22.17ms, FireAnimationFrame 5.62ms, Layout 5.34ms, EvaluateScript 3.76ms] / after [RunTask 58.37ms, ThreadControllerImpl::RunTask 58.25ms, RunMicrotasks 48.22ms, Receive mojo message 47.55ms, FunctionCall 23.85ms, FireAnimationFrame 6.05ms, Layout 4.96ms, EvaluateScript 3.88ms]
- mobile-iphone14: before [RunTask 55.66ms, ThreadControllerImpl::RunTask 55.53ms, RunMicrotasks 43.06ms, Receive mojo message 38ms, FunctionCall 25.67ms, FireAnimationFrame 6.87ms, EventDispatch 6.51ms, Layout 5.45ms] / after [RunTask 62.76ms, ThreadControllerImpl::RunTask 62.66ms, RunMicrotasks 52.3ms, Receive mojo message 43.74ms, FunctionCall 30.98ms, EventDispatch 8.78ms, FireAnimationFrame 7.08ms, Layout 6.15ms]

### Heartbeat latest growth

- desktop-chromium: before [RunTask 11.47ms, ThreadControllerImpl::RunTask 11.37ms, Receive mojo message 10.58ms, RunMicrotasks 5.05ms, EvaluateScript 3.95ms, FunctionCall 2.54ms, ParseHTML 0.64ms, Layout 0.59ms] / after [RunTask 11.15ms, ThreadControllerImpl::RunTask 11.08ms, Receive mojo message 10.29ms, RunMicrotasks 4.85ms, EvaluateScript 3.87ms, FunctionCall 2.85ms, ParseHTML 0.63ms, Layout 0.49ms]
- mobile-iphone14: before [RunTask 11.01ms, ThreadControllerImpl::RunTask 10.94ms, Receive mojo message 10.02ms, RunMicrotasks 4.54ms, EvaluateScript 3.85ms, FunctionCall 2.45ms, Layout 0.59ms, ParseHTML 0.57ms] / after [RunTask 14.4ms, ThreadControllerImpl::RunTask 14.28ms, Receive mojo message 12.23ms, RunMicrotasks 6.92ms, FunctionCall 3.73ms, EvaluateScript 3.6ms, ParseHTML 0.86ms, Layout 0.77ms]

### Room chat initial open

- desktop-chromium: before [RunTask 14.7ms, ThreadControllerImpl::RunTask 14.42ms, Receive mojo message 5.78ms, FunctionCall 5.51ms, FireAnimationFrame 4.89ms, PrePaint 4.47ms, EvaluateScript 4.06ms, Layout 3.57ms] / after [RunTask 13.85ms, ThreadControllerImpl::RunTask 13.56ms, FunctionCall 6.33ms, Receive mojo message 5.93ms, FireAnimationFrame 5.46ms, EvaluateScript 4.3ms, Layout 3.01ms, Paint 2.73ms]
- mobile-iphone14: before [RunTask 21.21ms, ThreadControllerImpl::RunTask 20.56ms, Receive mojo message 5.14ms, FunctionCall 4.55ms, MajorGC 4.45ms, V8.GC_MARK_COMPACTOR 4.37ms, FireAnimationFrame 4.1ms, EvaluateScript 3.63ms] / after [RunTask 7.1ms, ThreadControllerImpl::RunTask 6.98ms, Receive mojo message 6.23ms, EvaluateScript 4.26ms, Paint 0.26ms, PrePaint 0.1ms, Layerize 0.09ms, RunMicrotasks 0.05ms]

### Room chat load older

- desktop-chromium: before [RunTask 164.1ms, ThreadControllerImpl::RunTask 163.4ms, RunMicrotasks 129.94ms, FunctionCall 127.39ms, Receive mojo message 87.97ms, FireAnimationFrame 53.26ms, UpdateLayoutTree 25.89ms, Layout 15.6ms] / after [RunTask 211.57ms, ThreadControllerImpl::RunTask 210.96ms, RunMicrotasks 170.01ms, FunctionCall 167.89ms, Receive mojo message 98.54ms, FireAnimationFrame 73.52ms, UpdateLayoutTree 33.87ms, EventDispatch 26.71ms]
- mobile-iphone14: before [RunTask 163.22ms, ThreadControllerImpl::RunTask 162.66ms, FunctionCall 133.78ms, RunMicrotasks 130.89ms, Receive mojo message 82.56ms, FireAnimationFrame 65.21ms, UpdateLayoutTree 27.57ms, Layout 15.78ms] / after [RunTask 223.1ms, ThreadControllerImpl::RunTask 222.65ms, FunctionCall 188.87ms, RunMicrotasks 188.45ms, Receive mojo message 100.66ms, FireAnimationFrame 90.5ms, UpdateLayoutTree 38.54ms, EventDispatch 28.72ms]

### Room chat append while pinned

- desktop-chromium: before [RunTask 55.16ms, ThreadControllerImpl::RunTask 54.92ms, RunMicrotasks 39.97ms, Receive mojo message 37.57ms, FunctionCall 21ms, Layout 7.36ms, UpdateLayoutTree 7.1ms, EventDispatch 5.97ms] / after [RunTask 70.51ms, ThreadControllerImpl::RunTask 70.21ms, Receive mojo message 45.69ms, RunMicrotasks 44.85ms, FunctionCall 23.48ms, Layout 8.91ms, UpdateLayoutTree 8.13ms, FireAnimationFrame 5.91ms]
- mobile-iphone14: before [RunTask 50.46ms, ThreadControllerImpl::RunTask 50.36ms, RunMicrotasks 40.76ms, Receive mojo message 36.51ms, FunctionCall 25.87ms, EventDispatch 8.4ms, Layout 7.52ms, UpdateLayoutTree 6.6ms] / after [RunTask 48.59ms, ThreadControllerImpl::RunTask 48.39ms, RunMicrotasks 35.6ms, Receive mojo message 32.75ms, FunctionCall 21.35ms, Layout 6.89ms, EventDispatch 6.62ms, UpdateLayoutTree 6.23ms]

### Room chat append while away

- desktop-chromium: before [RunTask 47.75ms, ThreadControllerImpl::RunTask 47.64ms, Receive mojo message 38.55ms, RunMicrotasks 38.38ms, FunctionCall 18.33ms, Layout 9.78ms, FireAnimationFrame 6.94ms, UpdateLayoutTree 5.65ms] / after [RunTask 42.89ms, ThreadControllerImpl::RunTask 42.78ms, Receive mojo message 34.33ms, RunMicrotasks 34.22ms, FunctionCall 19.36ms, Layout 8.43ms, UpdateLayoutTree 5ms, EventDispatch 3.41ms]
- mobile-iphone14: before [RunTask 61.92ms, ThreadControllerImpl::RunTask 61.75ms, RunMicrotasks 47.95ms, Receive mojo message 42.06ms, FunctionCall 27.9ms, FireAnimationFrame 14.17ms, Layout 11.07ms, UpdateLayoutTree 7.58ms] / after [RunTask 45.56ms, ThreadControllerImpl::RunTask 45.46ms, Receive mojo message 36.56ms, RunMicrotasks 35.47ms, FunctionCall 18.15ms, Layout 7.97ms, UpdateLayoutTree 5.22ms, EventDispatch 3.94ms]


## Anchored Input Evidence

| Viewport | Input | Busy ms | Script ms | Layout ms | GC ms | Screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| desktop-chromium | wheel | 374.52 | 149.44 | 21.06 | 3.06 | `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-12-05-830Z/input-evidence/desktop-chromium/anchored-desktop-wheel-sequence.png` |
| desktop-chromium | keyboard | 104.02 | 66.6 | 11.63 | 1.53 | `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-12-05-830Z/input-evidence/desktop-chromium/anchored-desktop-keyboard-sequence.png` |
| mobile-iphone14 | touch | 201.32 | 158.94 | 31.77 | 1.85 | `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-12-05-830Z/input-evidence/mobile-iphone14/anchored-mobile-touch-sequence.png` |
| mobile-iphone14 | momentum | 291.62 | 223.66 | 45.06 | 3.32 | `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-19T18-12-05-830Z/input-evidence/mobile-iphone14/anchored-mobile-momentum-sequence.png` |

### Mutation Stability

#### Anchored list desktop wheel arbitration

- observed transitions: idle/idle -> idle/planning -> idle/scrolling -> idle/settling -> idle/idle -> idle/planning -> idle/scrolling -> idle/settling -> idle/idle -> wheel/idle -> wheel/deferred -> wheel/planning -> wheel/scrolling -> wheel/settling -> momentum/settling -> momentum/deferred -> wheel/deferred -> wheel/planning -> wheel/scrolling -> wheel/settling -> wheel/deferred -> momentum/deferred -> wheel/deferred -> momentum/deferred
- append: center row 6 -> 7; distance-to-latest 3038 -> 3124; user input wheel -> momentum; terminal none
- prepend: center row 13 -> 13; distance-to-latest 2224 -> 2224; user input wheel -> wheel; terminal none
- resize: center row 5 -> 6; distance-to-latest 3386 -> 3386; user input wheel -> wheel; terminal none
- collapse: center row 5 -> 4; distance-to-latest 3482 -> 3482; user input wheel -> wheel; terminal none

#### Anchored list desktop keyboard arbitration

- observed transitions: idle/planning -> idle/scrolling -> idle/settling -> idle/idle -> keyboard/idle -> keyboard/planning -> keyboard/scrolling -> keyboard/settling -> keyboard/idle -> idle/idle -> keyboard/idle -> keyboard/planning -> keyboard/scrolling -> keyboard/settling -> keyboard/idle -> idle/idle -> keyboard/idle -> keyboard/planning -> keyboard/scrolling -> keyboard/settling -> keyboard/idle -> idle/idle -> keyboard/idle -> idle/idle
- append: center row 2 -> 2; distance-to-latest 3758 -> 3944; user input keyboard -> keyboard; terminal none
- prepend: center row 2 -> 2; distance-to-latest 3944 -> 3944; user input keyboard -> keyboard; terminal none
- resize: center row -1 -> 1; distance-to-latest 4220 -> 4220; user input keyboard -> keyboard; terminal none
- collapse: center row -1 -> -1; distance-to-latest 4316 -> 4192; user input keyboard -> keyboard; terminal none

#### Anchored list iPhone touch arbitration

- observed transitions: idle/scrolling -> idle/settling -> idle/idle -> direct-manipulation/idle -> direct-manipulation/deferred -> direct-manipulation/planning -> direct-manipulation/scrolling -> direct-manipulation/settling -> momentum/settling -> momentum/deferred -> direct-manipulation/deferred -> direct-manipulation/planning -> direct-manipulation/scrolling -> direct-manipulation/settling -> momentum/settling -> momentum/deferred -> direct-manipulation/deferred -> direct-manipulation/planning -> direct-manipulation/scrolling -> direct-manipulation/settling -> momentum/settling -> momentum/deferred -> direct-manipulation/deferred -> momentum/deferred
- append: center row 3 -> 2; distance-to-latest 9632 -> 9818; user input direct-manipulation -> direct-manipulation; terminal none
- prepend: center row 2 -> 1; distance-to-latest 9998 -> 9998; user input direct-manipulation -> direct-manipulation; terminal none
- resize: center row -1 -> -1; distance-to-latest 10682 -> 10682; user input direct-manipulation -> direct-manipulation; terminal none
- collapse: center row -1 -> 0; distance-to-latest 10778 -> 10702; user input direct-manipulation -> direct-manipulation; terminal none

#### Anchored list iPhone momentum arbitration

- observed transitions: idle/scrolling -> idle/settling -> idle/idle -> direct-manipulation/idle -> direct-manipulation/deferred -> momentum/deferred -> momentum/planning -> momentum/scrolling -> idle/scrolling -> idle/settling -> idle/deferred -> idle/idle -> idle/planning -> idle/scrolling -> idle/settling -> idle/idle -> direct-manipulation/idle -> direct-manipulation/deferred -> momentum/deferred -> idle/idle -> idle/planning -> idle/scrolling -> idle/settling -> idle/idle
- append: center row 2 -> 2; distance-to-latest 9632 -> 10250; user input momentum -> idle; terminal none
- prepend: center row 1 -> 2; distance-to-latest 10094 -> 10094; user input momentum -> momentum; terminal none
- resize: center row 1 -> 2; distance-to-latest 10430 -> 10430; user input momentum -> momentum; terminal none
- collapse: center row -1 -> -1; distance-to-latest 10766 -> 10750; user input momentum -> momentum; terminal none

- Anchored input evidence uses Storybook-equivalent shared-law surfaces to show that desktop wheel/keyboard and iPhone touch/momentum paths stay away-from-latest while append, prepend, resize, and collapse mutations land.
