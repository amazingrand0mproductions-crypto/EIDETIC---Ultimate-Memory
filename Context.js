// @cache-compatible
const modifier = (text) => {
  try {
    const result = EIDETIC("contextAppend", text) || {};
    return { text: result.text === undefined ? text : result.text, stop: !!result.stop };
  } catch (err) {
    try { log("EIDETIC Context fallback: " + (err && err.message ? err.message : err)); } catch (_) {}
    return { text, stop: false };
  }
};

modifier(text);
