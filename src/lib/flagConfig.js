// src/lib/flagConfig.js
// ──────────────────────────────────────────────────────────────────
// Single source of truth for trainer follow-up flag thresholds.
// Change these numbers here and the flag engine picks them up.
// ──────────────────────────────────────────────────────────────────

export const FLAG_CONFIG = {
  // Flag if the client has had no activity for this many days
  inactiveDays: 5,

  // Flag if weekly adherence (%) falls below this value
  lowAdherencePct: 50,

  // Flag if weight has not been logged for this many weeks
  weightNotLoggedWeeks: 2,

  // Flag if effort rated >= this for two consecutive check-ins
  highEffortThreshold: 4,

  // How many consecutive high-effort check-ins trigger the flag
  highEffortConsecutive: 2,
};

export const FLAG_REASONS = {
  inactive:    `No activity for ${FLAG_CONFIG.inactiveDays}+ days`,
  lowAdherence:`Weekly adherence below ${FLAG_CONFIG.lowAdherencePct}%`,
  noWeight:    `Weight not logged for ${FLAG_CONFIG.weightNotLoggedWeeks}+ weeks`,
  highEffort:  `Effort rated ${FLAG_CONFIG.highEffortThreshold}–5 in ${FLAG_CONFIG.highEffortConsecutive} consecutive check-ins`,
};
