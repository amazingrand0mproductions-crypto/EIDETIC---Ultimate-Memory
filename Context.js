// @cache-compatible
// EIDETIC Schema 23: strict append-only Context modifier for AI Dungeon Optimized Context.
// The Library guarantees that the platform-supplied prompt remains an exact prefix.
const modifier = (text) => {
  try {
    const result = EIDETIC("contextAppend", text) || {};
    const out = result.text === undefined ? text : result.text;
    // Wrapper-level fail-safe: a cache-compatible modifier must never alter the prefix.
    if (typeof text === "string" && typeof out === "string" && out.slice(0, text.length) !== text) {
      try { log("EIDETIC Context cache-safe fallback: non-append mutation rejected."); } catch (_) {}
      return { text, stop: false };
    }
    return { text: out, stop: false };
  } catch (err) {
    try { log("EIDETIC Context fallback: " + (err && err.message ? err.message : err)); } catch (_) {}
    return { text, stop: false };
  }
};

modifier(text);
