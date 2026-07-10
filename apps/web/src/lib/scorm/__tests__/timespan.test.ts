import { describe, it, expect } from 'vitest'
import {
  parseTimespanToSeconds,
  formatSecondsToCmiTimespan,
  formatSecondsToIso8601,
  addSessionToTotal,
} from '../timespan'

describe('parseTimespanToSeconds', () => {
  it('parses SCORM 1.2 CMITimespan HH:MM:SS', () => {
    expect(parseTimespanToSeconds('01:30:15')).toBe(5415)
  })

  it('parses fractional seconds in CMITimespan', () => {
    expect(parseTimespanToSeconds('00:00:30.50')).toBe(30.5)
  })

  it('parses 4-digit-hour zero CMITimespan', () => {
    expect(parseTimespanToSeconds('0000:00:00')).toBe(0)
  })

  it('parses ISO-8601 2004 duration PT1H30M15S', () => {
    expect(parseTimespanToSeconds('PT1H30M15S')).toBe(5415)
  })

  it('parses ISO-8601 seconds-only PT30S', () => {
    expect(parseTimespanToSeconds('PT30S')).toBe(30)
  })

  it('parses ISO-8601 zero PT0S', () => {
    expect(parseTimespanToSeconds('PT0S')).toBe(0)
  })

  it('returns 0 for empty / null / undefined / garbage', () => {
    expect(parseTimespanToSeconds('')).toBe(0)
    expect(parseTimespanToSeconds(null)).toBe(0)
    expect(parseTimespanToSeconds(undefined)).toBe(0)
    expect(parseTimespanToSeconds('garbage')).toBe(0)
  })
})

describe('formatSecondsToCmiTimespan', () => {
  it('formats 5415 seconds', () => {
    expect(formatSecondsToCmiTimespan(5415)).toBe('01:30:15.00')
  })

  it('formats fractional seconds', () => {
    expect(formatSecondsToCmiTimespan(30.5)).toBe('00:00:30.50')
  })

  it('formats zero', () => {
    expect(formatSecondsToCmiTimespan(0)).toBe('00:00:00.00')
  })

  it('clamps negative to zero', () => {
    expect(formatSecondsToCmiTimespan(-5)).toBe('00:00:00.00')
  })
})

describe('formatSecondsToIso8601', () => {
  it('formats 5415 seconds', () => {
    expect(formatSecondsToIso8601(5415)).toBe('PT1H30M15S')
  })

  it('formats seconds-only', () => {
    expect(formatSecondsToIso8601(30)).toBe('PT30S')
  })

  it('formats zero as PT0S', () => {
    expect(formatSecondsToIso8601(0)).toBe('PT0S')
  })
})

describe('addSessionToTotal', () => {
  it('adds sessions for SCORM 1.2', () => {
    expect(addSessionToTotal('00:00:30', '00:00:15', '1.2')).toBe('00:00:45.00')
  })

  it('adds sessions for SCORM 2004', () => {
    expect(addSessionToTotal('PT30S', 'PT15S', '2004')).toBe('PT45S')
  })

  it('is idempotent with a fixed base (base does not accumulate)', () => {
    // Calling repeatedly with the SAME fixed base + session must yield the
    // same result every time — the base is never mutated/accumulated.
    expect(addSessionToTotal('00:01:00', '00:00:30', '1.2')).toBe('00:01:30.00')
    expect(addSessionToTotal('00:01:00', '00:00:30', '1.2')).toBe('00:01:30.00')
    expect(addSessionToTotal('00:01:00', '00:00:30', '1.2')).toBe('00:01:30.00')
  })
})
