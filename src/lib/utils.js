// src/lib/utils.js
// ──────────────────────────────────────────────────────────────────
// Shared utility functions used across the app.
// ──────────────────────────────────────────────────────────────────

/**
 * Calculates adherence % from a list of completion records.
 * adherence = (done items / total planned items) * 100
 * @param {Array} completions - rows from the completions table
 * @returns {number} percentage 0-100, rounded to 1 decimal place
 */
export function calcAdherence(completions) {
  if (!completions || completions.length === 0) return 0;
  const done = completions.filter((c) => c.done).length;
  return Math.round((done / completions.length) * 1000) / 10;
}

/**
 * Calculates the current streak (consecutive days with ≥1 done item).
 * @param {Array} completions - all completion rows for the client
 * @returns {number} streak in days
 */
export function calcStreak(completions) {
  if (!completions || completions.length === 0) return 0;

  // Collect unique dates that have at least one done item
  const doneDates = [
    ...new Set(
      completions.filter((c) => c.done).map((c) => c.date)
    ),
  ].sort((a, b) => (a > b ? -1 : 1)); // descending

  if (doneDates.length === 0) return 0;

  // Check from today backwards
  const today = todayISO();
  let streak = 0;
  let cursor = today;

  for (const date of doneDates) {
    if (date === cursor) {
      streak++;
      cursor = addDays(cursor, -1);
    } else if (date < cursor) {
      // Gap – streak broken
      break;
    }
  }

  return streak;
}

/**
 * Returns today's date as YYYY-MM-DD in local time.
 */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Adds `n` days to a YYYY-MM-DD string and returns a new YYYY-MM-DD.
 */
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the ISO date for the Monday of the week containing `dateStr`.
 */
export function weekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Pretty-formats a date string for display.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string} e.g. "18 Oct 2026"
 */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Pretty-formats a timestamp for display.
 */
export function fmtDateTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generates a random 6-character invite code.
 */
export function genInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Clamps a number between min and max.
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Groups an array by a key-getter function.
 */
export function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}
