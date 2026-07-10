import { describe, it, expect, vi } from 'vitest'
import {
  cmiKeyToTrackingField,
  isCompletionSignal,
  createScormApi,
  type ScormRuntimeConfig,
  type Scorm12Api,
  type Scorm2004Api,
} from '../api-factory'
import type { ScormVersion } from '../timespan'

/** Fresh config with spies + an empty (zero) initial data model. */
function makeConfig(version: ScormVersion): ScormRuntimeConfig {
  return {
    version,
    initial: {
      lessonStatus: null,
      score: null,
      totalTime: version === '2004' ? 'PT0S' : '0000:00:00',
      suspendData: null,
      completionStatus: null,
      successStatus: null,
      lessonLocation: null,
    },
    onPersist: vi.fn(),
    onCommit: vi.fn(),
    onComplete: vi.fn(),
  }
}

describe('cmiKeyToTrackingField', () => {
  it('maps SCORM 1.2 keys', () => {
    expect(cmiKeyToTrackingField('1.2', 'cmi.core.lesson_status')).toBe('lessonStatus')
    expect(cmiKeyToTrackingField('1.2', 'cmi.core.score.raw')).toBe('score')
    expect(cmiKeyToTrackingField('1.2', 'cmi.suspend_data')).toBe('suspendData')
    expect(cmiKeyToTrackingField('1.2', 'cmi.core.session_time')).toBe('sessionTime')
    expect(cmiKeyToTrackingField('1.2', 'cmi.core.bogus')).toBeNull()
  })

  it('maps SCORM 2004 keys', () => {
    expect(cmiKeyToTrackingField('2004', 'cmi.completion_status')).toBe('completionStatus')
    expect(cmiKeyToTrackingField('2004', 'cmi.success_status')).toBe('successStatus')
    expect(cmiKeyToTrackingField('2004', 'cmi.score.raw')).toBe('score')
    expect(cmiKeyToTrackingField('2004', 'cmi.score.scaled')).toBe('score')
    expect(cmiKeyToTrackingField('2004', 'cmi.location')).toBe('lessonLocation')
    expect(cmiKeyToTrackingField('2004', 'cmi.session_time')).toBe('sessionTime')
    expect(cmiKeyToTrackingField('2004', 'cmi.core.lesson_status')).toBeNull()
  })
})

describe('isCompletionSignal', () => {
  it('detects SCORM 1.2 completion', () => {
    expect(isCompletionSignal('1.2', 'cmi.core.lesson_status', 'passed')).toBe(true)
    expect(isCompletionSignal('1.2', 'cmi.core.lesson_status', 'completed')).toBe(true)
    expect(isCompletionSignal('1.2', 'cmi.core.lesson_status', 'incomplete')).toBe(false)
  })

  it('detects SCORM 2004 completion', () => {
    expect(isCompletionSignal('2004', 'cmi.completion_status', 'completed')).toBe(true)
    expect(isCompletionSignal('2004', 'cmi.success_status', 'passed')).toBe(true)
    expect(isCompletionSignal('2004', 'cmi.completion_status', 'incomplete')).toBe(false)
    expect(isCompletionSignal('2004', 'cmi.success_status', 'failed')).toBe(false)
  })
})

describe('createScormApi — SCORM 1.2', () => {
  it('exposes the API global name', () => {
    const { globalName } = createScormApi(makeConfig('1.2'))
    expect(globalName).toBe('API')
  })

  it('lesson_status "completed" triggers onComplete and persists lessonStatus', () => {
    const config = makeConfig('1.2')
    const { api } = createScormApi(config)
    ;(api as Scorm12Api).LMSSetValue('cmi.core.lesson_status', 'completed')

    expect(config.onComplete).toHaveBeenCalledTimes(1)
    expect(config.onPersist).toHaveBeenCalledWith({ lessonStatus: 'completed' })
  })

  it('score.raw persists numeric score', () => {
    const config = makeConfig('1.2')
    const { api } = createScormApi(config)
    ;(api as Scorm12Api).LMSSetValue('cmi.core.score.raw', '80')

    expect(config.onPersist).toHaveBeenCalledWith({ score: 80 })
    expect(config.onComplete).not.toHaveBeenCalled()
  })

  it('session_time persists an accumulated totalTime CMITimespan', () => {
    const config = makeConfig('1.2')
    const { api } = createScormApi(config)
    ;(api as Scorm12Api).LMSSetValue('cmi.core.session_time', '00:00:30')

    expect(config.onPersist).toHaveBeenCalledTimes(1)
    const persisted = (config.onPersist as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(persisted.totalTime).toBeDefined()
    // base '0000:00:00' + session '00:00:30' → '00:00:30.00'
    expect(persisted.totalTime).toBe('00:00:30.00')
  })

  it('LMSCommit flushes a snapshot object to onCommit', () => {
    const config = makeConfig('1.2')
    const { api } = createScormApi(config)
    ;(api as Scorm12Api).LMSCommit('')

    expect(config.onCommit).toHaveBeenCalledTimes(1)
    expect(config.onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ totalTime: expect.any(String) }),
    )
  })
})

describe('createScormApi — SCORM 2004', () => {
  it('exposes the API_1484_11 global name', () => {
    const { globalName } = createScormApi(makeConfig('2004'))
    expect(globalName).toBe('API_1484_11')
  })

  it('completion_status "completed" triggers onComplete', () => {
    const config = makeConfig('2004')
    const { api } = createScormApi(config)
    ;(api as Scorm2004Api).SetValue('cmi.completion_status', 'completed')

    expect(config.onComplete).toHaveBeenCalledTimes(1)
    expect(config.onPersist).toHaveBeenCalledWith({ completionStatus: 'completed' })
  })

  it('Terminate flushes a snapshot object to onCommit', () => {
    const config = makeConfig('2004')
    const { api } = createScormApi(config)
    ;(api as Scorm2004Api).Terminate('')

    expect(config.onCommit).toHaveBeenCalledTimes(1)
    expect(config.onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ totalTime: expect.any(String) }),
    )
  })

  it('score.scaled (0-1) is persisted as a 0-100 score', () => {
    const config = makeConfig('2004')
    const { api } = createScormApi(config)
    ;(api as Scorm2004Api).SetValue('cmi.score.scaled', '0.8')

    expect(config.onPersist).toHaveBeenCalledWith({ score: 80 })
  })
})
