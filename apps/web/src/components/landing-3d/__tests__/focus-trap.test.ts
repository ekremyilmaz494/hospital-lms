import { describe, it, expect } from 'vitest';
import { getTrapTarget } from '../focus-trap';

describe('getTrapTarget — drawer odak tuzağı', () => {
  it('son öğede Tab → başa sarar (0)', () => {
    expect(getTrapTarget(4, 5, false)).toBe(0);
  });

  it('ilk öğede Shift+Tab → sona sarar', () => {
    expect(getTrapTarget(0, 5, true)).toBe(4);
  });

  it('ortadaki öğede tarayıcının doğal davranışına bırakır (null)', () => {
    expect(getTrapTarget(2, 5, false)).toBeNull();
    expect(getTrapTarget(2, 5, true)).toBeNull();
  });

  it('ilk öğede Tab ve son öğede Shift+Tab doğal davranışa bırakılır', () => {
    expect(getTrapTarget(0, 5, false)).toBeNull();
    expect(getTrapTarget(4, 5, true)).toBeNull();
  });

  it('odaklanabilir öğe yoksa null', () => {
    expect(getTrapTarget(0, 0, false)).toBeNull();
    expect(getTrapTarget(-1, 0, true)).toBeNull();
  });

  it('odak drawer dışındaysa (-1) içeri alır: Tab ilk, Shift+Tab son öğe', () => {
    expect(getTrapTarget(-1, 5, false)).toBe(0);
    expect(getTrapTarget(-1, 5, true)).toBe(4);
  });

  it('tek öğede her iki yön de aynı öğeye sarar', () => {
    expect(getTrapTarget(0, 1, false)).toBe(0);
    expect(getTrapTarget(0, 1, true)).toBe(0);
  });
});
