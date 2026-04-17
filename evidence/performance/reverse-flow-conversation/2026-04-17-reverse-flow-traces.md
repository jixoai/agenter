# Reverse-Flow Conversation Trace Report

- baseline: `HEAD 5ef5d8baa3cf`
- candidate: working tree `/Users/kzf/.codex/worktrees/ac5b/agenter`
- raw traces: `/Users/kzf/.codex/worktrees/ac5b/agenter/.tmp/reverse-flow-conversation/2026-04-17T11-56-40-666Z`
- harness mode: production Vite build + Chromium trace capture

## Summary

| Viewport | Scenario | Busy ms | Script ms | Layout ms | GC ms | Long tasks |
| --- | --- | --- | --- | --- | --- | --- |
| desktop-chromium | Heartbeat initial open | 55.79 -> 21.2 (-34.59) | 29.22 -> 5.06 (-24.16) | 1.47 -> 0 (-1.47) | 5.16 -> 0 (-5.16) | 0 -> 0 |
| mobile-iphone14 | Heartbeat initial open | 95.4 -> 68.5 (-26.9) | 156.62 -> 76.83 (-79.79) | 11.41 -> 8.08 (-3.33) | 2.82 -> 3.78 (+0.96) | 0 -> 0 |
| desktop-chromium | Heartbeat load older | 1285.05 -> 224.43 (-1060.62) | 1383.76 -> 219.74 (-1164.02) | 93.49 -> 14.24 (-79.25) | 32.9 -> 4.5 (-28.4) | 4 -> 0 |
| mobile-iphone14 | Heartbeat load older | 1141.36 -> 398.95 (-742.41) | 1242.26 -> 389.2 (-853.06) | 99.02 -> 31.98 (-67.04) | 20.06 -> 7.3 (-12.76) | 0 -> 0 |
| desktop-chromium | Heartbeat latest append | 40.69 -> 116.05 (+75.36) | 24.17 -> 73 (+48.83) | 1.67 -> 7.59 (+5.92) | 0 -> 2.26 (+2.26) | 0 -> 0 |
| mobile-iphone14 | Heartbeat latest append | 61.99 -> 139.32 (+77.33) | 46.96 -> 100.41 (+53.45) | 3.12 -> 10.05 (+6.93) | 0 -> 3.66 (+3.66) | 0 -> 0 |
| desktop-chromium | Heartbeat latest growth | 31.84 -> 37.88 (+6.04) | 18.94 -> 24.79 (+5.85) | 1.42 -> 2.12 (+0.7) | 0 -> 0 (0) | 0 -> 0 |
| mobile-iphone14 | Heartbeat latest growth | 40.41 -> 29.25 (-11.16) | 32.17 -> 15 (-17.17) | 2.12 -> 1.18 (-0.94) | 0 -> 0 (0) | 0 -> 0 |
| desktop-chromium | Room chat initial open | 232.98 -> 71.1 (-161.88) | 273.43 -> 20.33 (-253.1) | 31.14 -> 5.03 (-26.11) | 5.59 -> 2.71 (-2.88) | 2 -> 0 |
| mobile-iphone14 | Room chat initial open | 213.05 -> 28.76 (-184.29) | 258.24 -> 9.68 (-248.56) | 28.57 -> 4.96 (-23.61) | 4.33 -> 0 (-4.33) | 2 -> 0 |
| desktop-chromium | Room chat load older | 292.92 -> 350.21 (+57.29) | 297.48 -> 362.8 (+65.32) | 38.93 -> 45.93 (+7) | 5.33 -> 5.64 (+0.31) | 2 -> 4 |
| mobile-iphone14 | Room chat load older | 270.6 -> 513.98 (+243.38) | 267 -> 587.67 (+320.67) | 35.64 -> 75.28 (+39.64) | 4.4 -> 7.42 (+3.02) | 2 -> 4 |
| desktop-chromium | Room chat append while pinned | 72.47 -> 113.17 (+40.7) | 63.51 -> 61.63 (-1.88) | 9.2 -> 13.76 (+4.56) | 0 -> 0 (0) | 0 -> 0 |
| mobile-iphone14 | Room chat append while pinned | 51.69 -> 97.37 (+45.68) | 43.92 -> 59.96 (+16.04) | 6.19 -> 14.51 (+8.32) | 0 -> 0 (0) | 0 -> 0 |
| desktop-chromium | Room chat append while away | 19.59 -> 102.82 (+83.23) | 5.14 -> 66.85 (+61.71) | 0.45 -> 15.23 (+14.78) | 2.06 -> 0 (-2.06) | 0 -> 0 |
| mobile-iphone14 | Room chat append while away | 18.62 -> 151.53 (+132.91) | 5.74 -> 122.62 (+116.88) | 0.47 -> 23.55 (+23.08) | 1.6 -> 2.62 (+1.02) | 0 -> 0 |

## Conclusions

- Heartbeat reverse-flow removes the worst open/load-older churn. Initial open busy ms: desktop 55.79 -> 21.2 (-34.59); mobile 95.4 -> 68.5 (-26.9). Load older busy ms: desktop 1285.05 -> 224.43 (-1060.62); mobile 1141.36 -> 398.95 (-742.41).
- Heartbeat append remains the residual hotspot: latest append busy ms regressed to desktop 40.69 -> 116.05 (+75.36); mobile 61.99 -> 139.32 (+77.33), while latest growth stayed flat-to-better at desktop 31.84 -> 37.88 (+6.04); mobile 40.41 -> 29.25 (-11.16). This isolates cost to newest-row insertion rather than post-measure growth.
- Room chat initial open improved materially, but older paging did not: initial open busy ms moved to desktop 232.98 -> 71.1 (-161.88); mobile 213.05 -> 28.76 (-184.29), while load older moved to desktop 292.92 -> 350.21 (+57.29); mobile 270.6 -> 513.98 (+243.38).
- Room chat append paths are the clearest remaining regression. Pinned append busy ms: desktop 72.47 -> 113.17 (+40.7); mobile 51.69 -> 97.37 (+45.68). Away-from-latest append busy ms: desktop 19.59 -> 102.82 (+83.23); mobile 18.62 -> 151.53 (+132.91). Trace tops shift toward RunMicrotasks / FunctionCall / Layout, which points at message merge and row-render churn rather than old scrollHeight polling.
- Next radar: Heartbeat append and all room-chat append/load-older scenarios still need dense-list renderer tiering or lighter row surfaces. Reverse-flow fixed the scroll-management law, but it did not remove heavy renderer work when new rows enter the transcript.

## Top Renderer Events

### Heartbeat initial open

- desktop-chromium: before [RunTask 28.01ms, ThreadControllerImpl::RunTask 27.77ms, Receive mojo message 10.64ms, FunctionCall 9.02ms, FireAnimationFrame 8.9ms, RunMicrotasks 5.65ms, EvaluateScript 4.96ms, MajorGC 3.49ms] / after [RunTask 10.67ms, ThreadControllerImpl::RunTask 10.53ms, Receive mojo message 8.76ms, EvaluateScript 4.64ms, Paint 0.44ms, Layerize 0.37ms, PrePaint 0.23ms, FireAnimationFrame 0.2ms]
- mobile-iphone14: before [FireAnimationFrame 51.82ms, FunctionCall 51.68ms, RunTask 47.87ms, ThreadControllerImpl::RunTask 47.52ms, RunMicrotasks 44.22ms, Receive mojo message 9.71ms, Layout 7.39ms, EvaluateScript 4.56ms] / after [RunTask 34.38ms, ThreadControllerImpl::RunTask 34.12ms, FireAnimationFrame 25.56ms, RunMicrotasks 24.64ms, FunctionCall 21.19ms, Receive mojo message 10.74ms, EvaluateScript 5.44ms, Layout 5.38ms]

### Heartbeat load older

- desktop-chromium: before [RunTask 643.19ms, ThreadControllerImpl::RunTask 641.86ms, FireAnimationFrame 478.54ms, RunMicrotasks 460.65ms, FunctionCall 428.47ms, Layout 57.8ms, Paint 38.77ms, UpdateLayoutTree 35.69ms] / after [RunTask 112.53ms, ThreadControllerImpl::RunTask 111.9ms, RunMicrotasks 82.11ms, FireAnimationFrame 65.87ms, FunctionCall 61.39ms, Receive mojo message 25.28ms, Layout 8.18ms, Paint 7.43ms]
- mobile-iphone14: before [RunTask 571.12ms, ThreadControllerImpl::RunTask 570.24ms, FireAnimationFrame 433.56ms, RunMicrotasks 405.29ms, FunctionCall 388.24ms, Layout 62.32ms, Paint 38ms, UpdateLayoutTree 36.7ms] / after [RunTask 199.88ms, ThreadControllerImpl::RunTask 199.07ms, RunMicrotasks 137.39ms, FireAnimationFrame 117.21ms, FunctionCall 112.22ms, Receive mojo message 29.58ms, Layout 18.82ms, EventDispatch 17.83ms]

### Heartbeat latest append

- desktop-chromium: before [RunTask 20.4ms, ThreadControllerImpl::RunTask 20.29ms, Receive mojo message 14.96ms, RunMicrotasks 9.93ms, FunctionCall 5.8ms, EvaluateScript 4.3ms, FireAnimationFrame 3.89ms, Paint 0.96ms] / after [RunTask 58.11ms, ThreadControllerImpl::RunTask 57.94ms, Receive mojo message 48.78ms, RunMicrotasks 45.77ms, FunctionCall 19.79ms, Layout 4.31ms, EvaluateScript 4.18ms, UpdateLayoutTree 3.28ms]
- mobile-iphone14: before [RunTask 31.05ms, ThreadControllerImpl::RunTask 30.95ms, RunMicrotasks 17.91ms, Receive mojo message 16.47ms, FunctionCall 12.91ms, FireAnimationFrame 11.38ms, EvaluateScript 4.49ms, Layout 1.81ms] / after [RunTask 69.75ms, ThreadControllerImpl::RunTask 69.57ms, RunMicrotasks 57.02ms, Receive mojo message 55.76ms, FunctionCall 28.42ms, FireAnimationFrame 10.24ms, Layout 5.97ms, EvaluateScript 4.72ms]

### Heartbeat latest growth

- desktop-chromium: before [RunTask 15.98ms, ThreadControllerImpl::RunTask 15.87ms, Receive mojo message 11.8ms, RunMicrotasks 6.21ms, FunctionCall 5.27ms, EvaluateScript 4.83ms, FireAnimationFrame 2.5ms, ParseHTML 1.18ms] / after [RunTask 19.04ms, ThreadControllerImpl::RunTask 18.84ms, Receive mojo message 12.8ms, RunMicrotasks 9.85ms, FunctionCall 6.72ms, EvaluateScript 4.16ms, FireAnimationFrame 4.05ms, ParseHTML 1.34ms]
- mobile-iphone14: before [RunTask 20.23ms, ThreadControllerImpl::RunTask 20.17ms, Receive mojo message 11.41ms, RunMicrotasks 10.14ms, FunctionCall 10.06ms, FireAnimationFrame 7.63ms, EvaluateScript 4.27ms, Layout 1.28ms] / after [RunTask 14.69ms, ThreadControllerImpl::RunTask 14.56ms, Receive mojo message 13.35ms, RunMicrotasks 6.94ms, EvaluateScript 4.64ms, FunctionCall 3.27ms, ParseHTML 0.8ms, Layout 0.78ms]

### Room chat initial open

- desktop-chromium: before [RunTask 116.75ms, ThreadControllerImpl::RunTask 116.23ms, FunctionCall 93.86ms, RunMicrotasks 79.07ms, EventDispatch 62.5ms, FireAnimationFrame 30.17ms, Layout 15.68ms, UpdateLayoutTree 15.46ms] / after [RunTask 35.95ms, ThreadControllerImpl::RunTask 35.14ms, Receive mojo message 10.81ms, EvaluateScript 8.63ms, FunctionCall 5.89ms, V8.GC_MC_INCREMENTAL 5.23ms, FireAnimationFrame 5.21ms, Layout 4.42ms]
- mobile-iphone14: before [RunTask 106.76ms, ThreadControllerImpl::RunTask 106.29ms, FunctionCall 88.71ms, RunMicrotasks 75.89ms, EventDispatch 53.74ms, FireAnimationFrame 34.24ms, UpdateLayoutTree 14.98ms, Layout 13.59ms] / after [RunTask 14.54ms, ThreadControllerImpl::RunTask 14.22ms, Receive mojo message 6.67ms, EvaluateScript 4.78ms, Layout 4.58ms, FunctionCall 2.66ms, FireAnimationFrame 1.85ms, Paint 1.67ms]

### Room chat load older

- desktop-chromium: before [RunTask 146.66ms, ThreadControllerImpl::RunTask 146.26ms, FunctionCall 132.65ms, RunMicrotasks 129.46ms, Receive mojo message 113.53ms, FireAnimationFrame 26.85ms, UpdateLayoutTree 24.63ms, Layout 14.3ms] / after [RunTask 175.34ms, ThreadControllerImpl::RunTask 174.87ms, RunMicrotasks 147.98ms, FunctionCall 140.69ms, Receive mojo message 100.42ms, FireAnimationFrame 61.91ms, UpdateLayoutTree 29.12ms, Layout 16.81ms]
- mobile-iphone14: before [RunTask 135.51ms, ThreadControllerImpl::RunTask 135.09ms, FunctionCall 121.09ms, RunMicrotasks 118.52ms, Receive mojo message 110.09ms, UpdateLayoutTree 22.4ms, FireAnimationFrame 18.91ms, Layout 13.23ms] / after [RunTask 257.26ms, ThreadControllerImpl::RunTask 256.72ms, FunctionCall 222.71ms, RunMicrotasks 221.92ms, Receive mojo message 107.05ms, FireAnimationFrame 107.04ms, UpdateLayoutTree 48.31ms, EventDispatch 35.54ms]

### Room chat append while pinned

- desktop-chromium: before [RunTask 36.3ms, ThreadControllerImpl::RunTask 36.17ms, FunctionCall 29.73ms, RunMicrotasks 25.57ms, Receive mojo message 23.14ms, UpdateLayoutTree 5.84ms, FireAnimationFrame 4.94ms, Layout 3.37ms] / after [RunTask 56.76ms, ThreadControllerImpl::RunTask 56.41ms, Receive mojo message 43.85ms, RunMicrotasks 40.27ms, FunctionCall 18.03ms, Layout 8.14ms, V8.GC_MC_INCREMENTAL 6.92ms, UpdateLayoutTree 5.62ms]
- mobile-iphone14: before [RunTask 25.89ms, ThreadControllerImpl::RunTask 25.8ms, FunctionCall 20.51ms, Receive mojo message 19.82ms, RunMicrotasks 19.7ms, UpdateLayoutTree 4.1ms, FireAnimationFrame 3.7ms, Layout 2.09ms] / after [RunTask 48.75ms, ThreadControllerImpl::RunTask 48.62ms, Receive mojo message 43.59ms, RunMicrotasks 39.96ms, FunctionCall 16.83ms, Layout 8.5ms, UpdateLayoutTree 6.01ms, FireAnimationFrame 3.12ms]

### Room chat append while away

- desktop-chromium: before [RunTask 9.85ms, ThreadControllerImpl::RunTask 9.74ms, Receive mojo message 6.45ms, RunMicrotasks 2.58ms, FunctionCall 2.53ms, MinorGC 2.06ms, V8.GC_SCAVENGER 1.49ms, V8.GC_SCAVENGER_SCAVENGE 1.47ms] / after [RunTask 51.53ms, ThreadControllerImpl::RunTask 51.29ms, Receive mojo message 40.25ms, RunMicrotasks 38.92ms, FunctionCall 20.58ms, Layout 9.69ms, FireAnimationFrame 6.59ms, UpdateLayoutTree 5.54ms]
- mobile-iphone14: before [RunTask 9.37ms, ThreadControllerImpl::RunTask 9.25ms, Receive mojo message 6.54ms, FunctionCall 2.87ms, RunMicrotasks 2.87ms, MinorGC 1.6ms, V8.GC_SCAVENGER 1.09ms, V8.GC_SCAVENGER_SCAVENGE 1.08ms] / after [RunTask 75.85ms, ThreadControllerImpl::RunTask 75.69ms, RunMicrotasks 62.56ms, Receive mojo message 49.29ms, FunctionCall 38.08ms, FireAnimationFrame 19.83ms, Layout 13.87ms, UpdateLayoutTree 9.68ms]

