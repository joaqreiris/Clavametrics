// assets/gps-parsers.js
// Multi-format date and duration parsers for the GPS import pipeline.
//
// Public API:
//   window.gpParseDate(value, format?)    → { iso, invalid, ambiguous }
//   window.gpParseDuration(value, format?) → { minutes, invalid }
//   window.gpDetectColType(samples)       → { type, format, ambiguousDateFormat }
//   window.gpAnalyzeCols(rows, headerRow) → array[colIndex] of { type, format, invalidCount, sampleCount, ambiguousDateFormat }
//   window.gpFmtDisplay(type, value, format?) → display string for preview cells
//   window.gpFormatLabel(fmt)             → human-readable format label
//   window.GPS_PARSE_DATE_FORMATS, window.GPS_PARSE_DURATION_FORMATS

(function () {
  'use strict';

  // Excel date epoch: 1899-12-30 UTC.
  // Formula: new Date(EXCEL_EPOCH_UTC + serial * 86400000)
  // Handles Excel's 1900 leap-year bug automatically (serial 60 = phantom Feb 29).
  const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

  // ── Format constants ─────────────────────────────────────────

  const DATE_FORMATS = {
    AUTO:         'auto',
    DMY:          'DD/MM/YYYY',    // European / LatAm default
    MDY:          'MM/DD/YYYY',    // US
    YMD:          'YYYY-MM-DD',    // ISO 8601
    EXCEL_SERIAL: 'excel_serial',  // integer serial number
    DMY_DASH:     'DD-MM-YYYY',
    MDY_DASH:     'MM-DD-YYYY',
  };

  const DURATION_FORMATS = {
    AUTO:       'auto',
    HHMMSS:     'HH:MM:SS',   // colon-delimited, hours can exceed 24
    HHMM:       'HH:MM',
    MMSS:       'MM:SS',
    MINUTES:    'minutes',    // plain numeric, already in minutes
    EXCEL_TIME: 'excel_time', // fractional day (0.052 = 75 min)
  };

  // ── Internal helpers ─────────────────────────────────────────

  function _pad(n) { return String(n).padStart(2, '0'); }

  function _isoDate(y, m, d) {
    return `${y}-${_pad(m)}-${_pad(d)}`;
  }

  function _validYMD(y, m, d) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  // ── parseDate ────────────────────────────────────────────────

  /**
   * Parse a raw cell value as a date.
   *
   * Returns { iso: 'YYYY-MM-DD' | null, invalid: boolean, ambiguous: boolean }
   *
   * ambiguous: true when DD/MM vs MM/DD cannot be determined from the value alone
   * (both parts ≤ 12). Default interpretation: DD/MM/YYYY (European/LatAm).
   *
   * Formats tried in order (respects the `format` override):
   *   1. JS Date object (SheetJS cellDates:true for XLSX)
   *   2. Excel serial integer  (18000–73000 → 1950–2099)
   *   3. ISO 8601  YYYY-MM-DD[T...]
   *   4. DD/MM/YYYY or MM/DD/YYYY  (slash-delimited)
   *   5. DD-MM-YYYY or MM-DD-YYYY  (dash-delimited)
   *   6. Month-name strings  ("Jan 9 2025", "9 January 2025")
   */
  function parseDate(value, format) {
    if (value === null || value === undefined || value === '') {
      return { iso: null, invalid: false, ambiguous: false };
    }
    const fmt = format || DATE_FORMATS.AUTO;

    // 1. Date object from SheetJS (cellDates:true)
    if (value instanceof Date) {
      if (isNaN(value)) return { iso: null, invalid: true, ambiguous: false };
      const yr = value.getUTCFullYear();
      // Year 1899/1900 = time serial, not a real date
      if (yr === 1899 || yr === 1900) return { iso: null, invalid: true, ambiguous: false };
      if (yr < 1900 || yr > 2100)     return { iso: null, invalid: true, ambiguous: false };
      return { iso: _isoDate(yr, value.getUTCMonth() + 1, value.getUTCDate()), invalid: false, ambiguous: false };
    }

    // 2. Excel serial number (integer, plausible modern date range)
    if (typeof value === 'number') {
      if (Number.isInteger(value) && value >= 18000 && value <= 73000 &&
          (fmt === DATE_FORMATS.EXCEL_SERIAL || fmt === DATE_FORMATS.AUTO)) {
        const dt = new Date(EXCEL_EPOCH_UTC + value * 86400000);
        const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
        if (_validYMD(y, m, d)) return { iso: _isoDate(y, m, d), invalid: false, ambiguous: false };
      }
      return { iso: null, invalid: true, ambiguous: false };
    }

    const s = String(value).trim();

    // 3. ISO 8601: YYYY-MM-DD[T...]
    if (/^\d{4}-\d{2}-\d{2}/.test(s) && (fmt === DATE_FORMATS.YMD || fmt === DATE_FORMATS.AUTO)) {
      const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
      if (_validYMD(y, m, d)) return { iso: _isoDate(y, m, d), invalid: false, ambiguous: false };
      return { iso: null, invalid: true, ambiguous: false };
    }

    // 4. Slash-delimited: DD/MM/YYYY or MM/DD/YYYY
    const slashM = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashM) {
      const [, a, b, y] = slashM.map(Number);
      if (fmt === DATE_FORMATS.MDY) {
        if (_validYMD(y, a, b)) return { iso: _isoDate(y, a, b), invalid: false, ambiguous: false };
        return { iso: null, invalid: true, ambiguous: false };
      }
      // DMY or AUTO: default DD/MM/YYYY (European/LatAm)
      if (a > 12) { // a is definitely the day
        if (_validYMD(y, b, a)) return { iso: _isoDate(y, b, a), invalid: false, ambiguous: false };
        return { iso: null, invalid: true, ambiguous: false };
      }
      if (b > 12) { // b is definitely the day → must be MM/DD/YYYY
        if (_validYMD(y, a, b)) return { iso: _isoDate(y, a, b), invalid: false, ambiguous: false };
        return { iso: null, invalid: true, ambiguous: false };
      }
      // Both ≤ 12: ambiguous — default DD/MM/YYYY
      if (_validYMD(y, b, a)) return { iso: _isoDate(y, b, a), invalid: false, ambiguous: true };
      return { iso: null, invalid: true, ambiguous: false };
    }

    // 5. Dash-delimited: DD-MM-YYYY or MM-DD-YYYY
    const dashM = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashM) {
      const [, a, b, y] = dashM.map(Number);
      if (fmt === DATE_FORMATS.MDY_DASH) {
        if (_validYMD(y, a, b)) return { iso: _isoDate(y, a, b), invalid: false, ambiguous: false };
        return { iso: null, invalid: true, ambiguous: false };
      }
      // Default DMY_DASH
      if (a > 12) {
        if (_validYMD(y, b, a)) return { iso: _isoDate(y, b, a), invalid: false, ambiguous: false };
      } else if (b > 12) {
        if (_validYMD(y, a, b)) return { iso: _isoDate(y, a, b), invalid: false, ambiguous: false };
      } else if (_validYMD(y, b, a)) {
        return { iso: _isoDate(y, b, a), invalid: false, ambiguous: true };
      }
      return { iso: null, invalid: true, ambiguous: false };
    }

    // 6. Month-name strings: "Jan 9 2025", "9 January 2025", "January 9, 2025"
    if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*/i.test(s)) {
      const dt = new Date(s);
      if (!isNaN(dt)) {
        const y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate();
        if (_validYMD(y, m, d)) return { iso: _isoDate(y, m, d), invalid: false, ambiguous: false };
      }
    }

    return { iso: null, invalid: true, ambiguous: false };
  }

  // ── parseDuration ────────────────────────────────────────────

  /**
   * Parse a raw cell value as a duration.
   *
   * Returns { minutes: number | null, invalid: boolean }
   * Output: minutes as decimal (e.g. 75.25 for 1h 15m 15s).
   *
   * Formats tried in order:
   *   1. JS Date object from Excel time serial (year 1899/1900, SheetJS cellDates:true)
   *   2. Numeric Excel time fraction  (value in (0,1) with high precision ≈ 0.052)
   *   3. Plain number  (75, 75.5 → already in minutes)
   *   4. HH:MM:SS string  (hours may exceed 24: "90:15:00")
   *   5. HH:MM string  (default) or MM:SS (if format=MMSS)
   *   6. Explicit unit: "75 min", "1.25 h", "4500 s"
   *   7. Plain number string
   *
   * IMPORTANT: SheetJS 0.20 creates time-serial Date objects using new Date(year, month, day, h, m, s)
   * (LOCAL constructor), so we use getHours()/getMinutes()/getSeconds() (local), not UTC.
   */
  function parseDuration(value, format) {
    if (value === null || value === undefined || value === '') {
      return { minutes: null, invalid: false };
    }
    const fmt = format || DURATION_FORMATS.AUTO;

    // 1. Date object — time serial from SheetJS (year 1899/1900, local constructor)
    //    SheetJS creates: new Date(1899, 11, 30, hours, minutes, seconds)
    //    Use LOCAL getters — UTC getters are timezone-shifted and produce wrong values.
    if (value instanceof Date) {
      if (isNaN(value)) return { minutes: null, invalid: true };
      // Check local year (matches SheetJS's local constructor)
      const yr = value.getFullYear();
      if (yr === 1899 || yr === 1900) {
        const h = value.getHours();    // LOCAL — correct for SheetJS local constructor
        const m = value.getMinutes();
        const s = value.getSeconds();
        return { minutes: +(h * 60 + m + s / 60).toFixed(2), invalid: false };
      }
      return { minutes: null, invalid: true };
    }

    // 2 & 3. Numeric value
    if (typeof value === 'number') {
      if (value < 0) return { minutes: null, invalid: true };
      if (fmt === DURATION_FORMATS.EXCEL_TIME ||
          (fmt === DURATION_FORMATS.AUTO && value > 0 && value < 1)) {
        // Excel time fraction: multiply by 1440 min/day
        return { minutes: +(value * 1440).toFixed(2), invalid: false };
      }
      // Plain minutes
      if (fmt === DURATION_FORMATS.MINUTES || fmt === DURATION_FORMATS.AUTO) {
        return { minutes: +(value).toFixed(2), invalid: false };
      }
      return { minutes: null, invalid: true };
    }

    const s = String(value).trim();

    // 4. HH:MM:SS — hours may exceed 24 (e.g. "90:00:00" = 90 minutes is not a valid case,
    //    but "01:15:15" = 75.25 minutes is correct)
    const hmsM = s.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (hmsM) {
      const h   = +hmsM[1];
      const m   = +hmsM[2];
      const sec = +hmsM[3];
      // Validate minute and second components
      if (m < 60 && sec < 60) {
        if (fmt === DURATION_FORMATS.HHMMSS || fmt === DURATION_FORMATS.AUTO) {
          return { minutes: +(h * 60 + m + sec / 60).toFixed(2), invalid: false };
        }
      }
      return { minutes: null, invalid: true };
    }

    // 5. HH:MM or MM:SS
    const hmM = s.match(/^(\d+):(\d{2})$/);
    if (hmM) {
      const a = +hmM[1];
      const b = +hmM[2];
      if (b >= 60) return { minutes: null, invalid: true };
      if (fmt === DURATION_FORMATS.MMSS) {
        return { minutes: +(a + b / 60).toFixed(2), invalid: false };
      }
      // Default: HH:MM
      if (fmt === DURATION_FORMATS.HHMM || fmt === DURATION_FORMATS.AUTO) {
        return { minutes: +(a * 60 + b).toFixed(2), invalid: false };
      }
      return { minutes: null, invalid: true };
    }

    // 6. Explicit unit: "75 min", "1.25 h", "4500 s", "75.5min"
    const unitM = s.match(/^(\d+(?:\.\d+)?)\s*(min(?:utes?)?|h(?:ours?)?|s(?:ec(?:onds?)?)?)$/i);
    if (unitM) {
      const v = +unitM[1], unit = unitM[2].toLowerCase();
      if (unit.startsWith('h')) return { minutes: +(v * 60).toFixed(2), invalid: false };
      if (unit.startsWith('s')) return { minutes: +(v / 60).toFixed(2), invalid: false };
      return { minutes: +v.toFixed(2), invalid: false };
    }

    // 7. Plain number string
    const num = +s;
    if (!isNaN(num) && isFinite(num) && num >= 0) {
      if (fmt === DURATION_FORMATS.MINUTES || fmt === DURATION_FORMATS.AUTO) {
        return { minutes: +num.toFixed(2), invalid: false };
      }
    }

    return { minutes: null, invalid: true };
  }

  // ── detectColumnType ─────────────────────────────────────────

  /**
   * Infer the most likely type for a column from sample values.
   * Column names are NOT used — only content decides.
   *
   * samples : array of raw cell values (first 20 non-empty)
   *
   * Duration is only detected when content explicitly shows it:
   *   • JS Date objects with local year 1899/1900 (SheetJS time serials)
   *   • Numbers in (0, 1) with ≥4 decimal places (Excel time fraction, e.g. 0.0521)
   *   • Strings matching ^\d+:\d{2}(:\d{2})?$  (HH:MM:SS or HH:MM format)
   *   • Strings matching explicit time units (min, h, hr, s, sec)
   *
   * Plain integers (sprint counts, effort counts, distances) are NOT treated as duration.
   *
   * Returns { type: 'date'|'duration'|'number'|'text', format, ambiguousDateFormat }
   */
  function detectColumnType(samples) {
    const THRESHOLD = 0.60;
    const nonEmpty  = samples.filter(v => v !== null && v !== undefined && v !== '');
    if (!nonEmpty.length) return { type: 'text', format: null, ambiguousDateFormat: false };

    let dateV = 0, durV = 0, numV = 0;
    let ambigDate = 0;

    for (const v of nonEmpty) {
      // ── JS Date objects from SheetJS ──
      if (v instanceof Date) {
        const yr = v.getFullYear(); // local year, matches SheetJS local constructor
        if (yr === 1899 || yr === 1900) { durV++;  continue; }
        if (yr >  1900)                 { dateV++; continue; }
        numV++;
        continue;
      }

      // ── Numbers ──
      if (typeof v === 'number') {
        if (Number.isInteger(v) && v >= 18000 && v <= 73000) {
          // Plausible Excel date serial (1950-2099)
          dateV++;
        } else if (v > 0 && v < 1 && _hasManyDecimals(v)) {
          // Plausible Excel time fraction (e.g. 0.052257 for 01:15:15)
          // Integers and low-precision numbers (0, 1, 2 sprint counts) do NOT qualify
          durV++;
        } else {
          numV++;
        }
        continue;
      }

      // ── Strings ──
      const sv = String(v).trim();

      // Try date first
      const dr = parseDate(v, DATE_FORMATS.AUTO);
      if (!dr.invalid && dr.iso) {
        dateV++;
        if (dr.ambiguous) ambigDate++;
        continue;
      }

      // Duration: only colon-delimited or explicit-unit strings
      // Bare number strings fall through to numV — avoids misclassifying distance/load/speed cols
      if (/^\d+:\d{2}(:\d{2})?$/.test(sv)) {
        // Colon-delimited (HH:MM:SS or HH:MM)
        const dd = parseDuration(v, DURATION_FORMATS.AUTO);
        if (!dd.invalid && dd.minutes !== null) { durV++; continue; }
      } else if (/^\d+(?:\.\d+)?\s*(?:min(?:utes?)?|h(?:ours?|r)?|s(?:ec(?:onds?)?)?)$/i.test(sv)) {
        // Explicit time unit string
        const dd = parseDuration(v, DURATION_FORMATS.AUTO);
        if (!dd.invalid && dd.minutes !== null) { durV++; continue; }
      }

      // Number string
      const n = +sv;
      if (!isNaN(n) && isFinite(n)) { numV++; continue; }
      // else: text — no vote
    }

    const total = nonEmpty.length;

    if (dateV / total >= THRESHOLD) {
      return {
        type: 'date',
        format: DATE_FORMATS.AUTO,
        ambiguousDateFormat: dateV > 0 && ambigDate / dateV >= 0.30,
      };
    }
    if (durV / total >= THRESHOLD) {
      return { type: 'duration', format: DURATION_FORMATS.AUTO, ambiguousDateFormat: false };
    }
    if (numV / total >= THRESHOLD) {
      return { type: 'number', format: null, ambiguousDateFormat: false };
    }

    return { type: 'text', format: null, ambiguousDateFormat: false };
  }

  // True if a number has ≥4 significant decimal digits (e.g. 0.0521 but not 0.5 or 0.05)
  function _hasManyDecimals(v) {
    const s = String(v);
    const dot = s.indexOf('.');
    return dot !== -1 && s.length - dot - 1 >= 4;
  }

  // ── analyzeColumns ───────────────────────────────────────────

  /**
   * Run type detection on all columns.
   *
   * rows      : all rows from the parsed file
   * headerRow : 0-based index of the header row
   *
   * Returns array indexed by column index:
   *   { type, format, ambiguousDateFormat, invalidCount, sampleCount }
   */
  function analyzeColumns(rows, headerRow) {
    const hdr  = rows[headerRow] || [];
    const data = rows.slice(headerRow + 1, headerRow + 21); // first 20 data rows
    const out  = [];

    for (let i = 0; i < hdr.length; i++) {
      const samples = data.map(r => r[i]).filter(v => v !== null && v !== undefined && v !== '');
      const info    = detectColumnType(samples);

      let invalidCount = 0;
      for (const v of samples) {
        if (info.type === 'date')     { if (parseDate(v, info.format).invalid)     invalidCount++; }
        if (info.type === 'duration') { if (parseDuration(v, info.format).invalid) invalidCount++; }
      }

      out[i] = { ...info, invalidCount, sampleCount: samples.length };
    }
    return out;
  }

  // ── gpFmtDisplay ─────────────────────────────────────────────

  /**
   * Render a raw cell value as a human-readable string for the preview table.
   *
   * type  : 'date' | 'duration' | 'number' | 'text' | 'ignore'
   * value : raw cell value
   * format: optional format hint
   */
  function gpFmtDisplay(type, value, format) {
    if (value === null || value === undefined || value === '') return '';

    if (type === 'date') {
      const r = parseDate(value, format);
      return r.iso || String(value);
    }

    if (type === 'duration') {
      const r = parseDuration(value, format);
      if (r.minutes !== null) {
        const m  = Math.floor(r.minutes);
        const s  = Math.round((r.minutes - m) * 60);
        return s > 0 ? `${m}m ${s}s` : `${m} min`;
      }
      return String(value);
    }

    // number / text / ignore — normalise stray Date objects so the preview is readable
    if (value instanceof Date && !isNaN(value)) {
      const yr = value.getFullYear();
      if (yr === 1899 || yr === 1900) {
        const r = parseDuration(value);
        if (r.minutes !== null) {
          const m = Math.floor(r.minutes);
          const s = Math.round((r.minutes - m) * 60);
          return s > 0 ? `${m}m ${s}s` : `${m} min`;
        }
      }
      return _isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
    }

    return String(value ?? '');
  }

  // ── gpFormatLabel ────────────────────────────────────────────

  const _FMT_LABELS = {
    [DATE_FORMATS.AUTO]:           'Auto-detect',
    [DATE_FORMATS.DMY]:            'DD/MM/YYYY',
    [DATE_FORMATS.MDY]:            'MM/DD/YYYY',
    [DATE_FORMATS.YMD]:            'YYYY-MM-DD',
    [DATE_FORMATS.EXCEL_SERIAL]:   'Excel serial',
    [DATE_FORMATS.DMY_DASH]:       'DD-MM-YYYY',
    [DATE_FORMATS.MDY_DASH]:       'MM-DD-YYYY',
    [DURATION_FORMATS.AUTO]:       'Auto-detect',
    [DURATION_FORMATS.HHMMSS]:     'HH:MM:SS',
    [DURATION_FORMATS.HHMM]:       'HH:MM',
    [DURATION_FORMATS.MMSS]:       'MM:SS',
    [DURATION_FORMATS.MINUTES]:    'Minutes (numeric)',
    [DURATION_FORMATS.EXCEL_TIME]: 'Excel time fraction',
  };

  function gpFormatLabel(fmt) {
    return _FMT_LABELS[fmt] || 'Auto-detect';
  }

  // ── Number parser — locale-aware ────────────────────────────
  // opts.decimal: 'dot' (US/default) | 'comma' (European: . = thousands, , = decimal)
  // Returns { value: number|null, invalid: bool }
  function parseNumber(raw, opts) {
    if (raw == null) return { value: null, invalid: true };
    let s = String(raw).trim();
    if (!s) return { value: null, invalid: true };
    const decimal = (opts && opts.decimal) || 'dot';
    if (decimal === 'comma') {
      // European: remove dot thousands separators, then comma → decimal point
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // US/default: remove comma thousands separators
      s = s.replace(/,/g, '');
    }
    // Strip residual non-numeric chars (units glued to value, e.g. "28.2m")
    s = s.replace(/[^0-9.\-+eE]/g, '');
    const n = Number(s);
    if (!isFinite(n) || isNaN(n)) return { value: null, invalid: true };
    return { value: n, invalid: false };
  }

  // ── Expose public API ────────────────────────────────────────
  window.GPS_PARSE_DATE_FORMATS     = DATE_FORMATS;
  window.GPS_PARSE_DURATION_FORMATS = DURATION_FORMATS;
  window.gpParseDate     = parseDate;
  window.gpParseDuration = parseDuration;
  window.gpParseNumber   = parseNumber;
  window.gpDetectColType = detectColumnType;
  window.gpAnalyzeCols   = analyzeColumns;
  window.gpFmtDisplay    = gpFmtDisplay;
  window.gpFormatLabel   = gpFormatLabel;
})();
