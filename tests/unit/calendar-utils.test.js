import { describe, it, expect } from 'vitest';
import {
  addDays, daysBetween, fmtShort,
  focusToClass, EVT_ICONS, DAYS_SHORT, MONTHS_SHORT,
} from '../../assets/calendar-utils.js';

// ── addDays ───────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds days within same month',    () => expect(addDays('2026-05-01', 5)).toBe('2026-05-06'));
  it('crosses month boundary',         () => expect(addDays('2026-01-28', 5)).toBe('2026-02-02'));
  it('crosses year boundary',          () => expect(addDays('2025-12-30', 3)).toBe('2026-01-02'));
  it('subtracts with negative n',      () => expect(addDays('2026-03-01', -1)).toBe('2026-02-28'));
  it('n=0 returns same date',          () => expect(addDays('2026-07-15', 0)).toBe('2026-07-15'));
  it('handles leap year Feb',          () => expect(addDays('2024-02-28', 1)).toBe('2024-02-29'));
  it('skips leap day in non-leap year',() => expect(addDays('2025-02-28', 1)).toBe('2025-03-01'));

  it('output is always YYYY-MM-DD padded', () => {
    expect(addDays('2026-01-01', 0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(addDays('2026-09-01', 0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('no timezone drift: Jan 1 + 0 stays Jan 1', () => {
    // Local Date constructor avoids UTC midnight off-by-one
    expect(addDays('2026-01-01', 0)).toBe('2026-01-01');
  });
});

// ── daysBetween ───────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns positive for future date',   () => expect(daysBetween('2026-05-01', '2026-05-08')).toBe(7));
  it('returns negative for past date',     () => expect(daysBetween('2026-05-08', '2026-05-01')).toBe(-7));
  it('returns 0 for same date',            () => expect(daysBetween('2026-05-15', '2026-05-15')).toBe(0));
  it('crosses month boundary',             () => expect(daysBetween('2026-04-28', '2026-05-03')).toBe(5));
  it('result of addDays(d, n) is n days',  () => {
    const start = '2026-06-10';
    expect(daysBetween(start, addDays(start, 14))).toBe(14);
  });
});

// ── fmtShort ──────────────────────────────────────────────────────────────────

describe('fmtShort', () => {
  it('formats a known date — Tue 19 May', () => {
    expect(fmtShort(new Date(2026, 4, 19))).toBe('Tue 19 May');
  });
  it('uses DAYS_SHORT for day name', () => {
    const d = new Date(2026, 0, 4); // Sunday Jan 4
    expect(fmtShort(d)).toMatch(/^Sun/);
  });
  it('uses MONTHS_SHORT for month name', () => {
    const d = new Date(2026, 11, 25); // Dec 25
    expect(fmtShort(d)).toMatch(/Dec$/);
  });
});

// ── focusToClass ──────────────────────────────────────────────────────────────

describe('focusToClass', () => {
  describe('→ training (default)', () => {
    it.each([null, undefined, ''])('maps falsy %s to training', v => {
      expect(focusToClass(v)).toBe('training');
    });
    it.each(['Technical', 'Tactical', 'Conditioning', 'Speed', 'Activation', 'Pressing'])(
      'maps "%s" to training', v => expect(focusToClass(v)).toBe('training')
    );
  });

  describe('→ match', () => {
    it.each(['Match', 'match', 'MATCH', 'Game', 'game', 'partido'])(
      'maps "%s" to match', v => expect(focusToClass(v)).toBe('match')
    );
  });

  describe('→ gym', () => {
    it.each(['Gym', 'gym', 'Strength', 'strength', 'Weights', 'weights', 'Fuerza', 'fuerza'])(
      'maps "%s" to gym', v => expect(focusToClass(v)).toBe('gym')
    );
  });

  describe('→ recovery', () => {
    it.each(['Recovery', 'recovery', 'Rest', 'rest', 'regenerativo', 'Regenerative', 'regen'])(
      'maps "%s" to recovery', v => expect(focusToClass(v)).toBe('recovery')
    );
  });

  describe('→ travel', () => {
    it.each(['Travel', 'travel', 'viaje', 'trip'])(
      'maps "%s" to travel', v => expect(focusToClass(v)).toBe('travel')
    );
  });

  it('is case-insensitive', () => {
    expect(focusToClass('MATCH')).toBe('match');
    expect(focusToClass('GYM')).toBe('gym');
    expect(focusToClass('RECOVERY')).toBe('recovery');
  });
});

// ── EVT_ICONS ─────────────────────────────────────────────────────────────────

describe('EVT_ICONS', () => {
  const CATEGORIES = ['training', 'gym', 'match', 'recovery', 'travel'];

  it('has an icon for every focusToClass output category', () => {
    CATEGORIES.forEach(cat => expect(EVT_ICONS[cat]).toBeDefined());
  });
  it('all icon strings start with "ti-"', () => {
    CATEGORIES.forEach(cat => expect(EVT_ICONS[cat]).toMatch(/^ti-/));
  });
  it('EVT_ICONS and focusToClass are in sync — no unmapped category', () => {
    CATEGORIES.forEach(cat => expect(EVT_ICONS).toHaveProperty(cat));
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('DAYS_SHORT', () => {
  it('has 7 entries', () => expect(DAYS_SHORT).toHaveLength(7));
  it('starts with Sun', () => expect(DAYS_SHORT[0]).toBe('Sun'));
  it('ends with Sat',   () => expect(DAYS_SHORT[6]).toBe('Sat'));
});

describe('MONTHS_SHORT', () => {
  it('has 12 entries',    () => expect(MONTHS_SHORT).toHaveLength(12));
  it('starts with Jan',   () => expect(MONTHS_SHORT[0]).toBe('Jan'));
  it('ends with Dec',     () => expect(MONTHS_SHORT[11]).toBe('Dec'));
});
