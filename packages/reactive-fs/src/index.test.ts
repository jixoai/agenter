import { describe, expect, it } from 'vitest'

import * as api from './index.js'

describe('Feature: reactive-fs package boundary', () => {
  it('Scenario: Given Agenter imports the package When package exports are inspected Then only filesystem-reactive primitives are exposed', () => {
    const exportedNames = Object.keys(api).sort()

    expect(exportedNames).toEqual([
      'ProjectWatcher',
      'ReactiveContext',
      'ReactiveState',
      'acquireWatcher',
      'clearCache',
      'closeAllProjectWatchers',
      'closeAllWatchers',
      'contextStorage',
      'ensureWatcherRootForPath',
      'getActiveWatcherCount',
      'getCacheSize',
      'getProjectWatcher',
      'getWatchedProjectDir',
      'getWatcherRuntimeStatus',
      'initWatcherPool',
      'isWatcherPoolInitialized',
      'listWatcherRuntimeStatuses',
      'reactiveExists',
      'reactiveReadDir',
      'reactiveReadFile',
      'reactiveStat',
      'subscribeWatcherRuntimeStatus',
      'updateReactiveFileCache',
    ])
    expect(exportedNames.every((name) => !/Prompt|Avatar|OpenSpec|Daemon|Studio|Shell/u.test(name))).toBe(true)
  })
})
