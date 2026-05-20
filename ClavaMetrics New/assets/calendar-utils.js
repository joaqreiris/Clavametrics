// Pure utility functions shared between Calendar.html and test suite.
// Calendar.html inlines equivalent definitions — keep in sync if modified.

export const EVT_ICONS = {
  training: 'ti-soccer-field',
  gym:      'ti-barbell',
  match:    'ti-ball-football',
  recovery: 'ti-heart-rate-monitor',
};

export const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmtShort(d) {
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// Uses local-time Date constructor to avoid UTC midnight off-by-one in UTC- timezones.
export function addDays(dateStr, n) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const r = new Date(y, mo - 1, d + n);
  return (
    r.getFullYear() + '-' +
    String(r.getMonth() + 1).padStart(2, '0') + '-' +
    String(r.getDate()).padStart(2, '0')
  );
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Maps DB session_type values to CSS display categories.
// New schema values: match, gym, recovery, tactical, conditioning, other
export function focusToClass(focus) {
  if (!focus) return 'training';
  const f = focus.toLowerCase();
  if (f === 'match')    return 'match';
  if (f === 'gym')      return 'gym';
  if (f === 'recovery') return 'recovery';
  return 'training'; // tactical, conditioning, other → training
}
