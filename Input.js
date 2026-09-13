const modifier = (text) => {
  try {
    const result = EIDETIC("input", text) || {};
    return { text: result.text === undefined ? text : result.text, stop: !!result.stop };
  } catch (err) {
    try { log("EIDETIC Input fallback: " + (err && err.message ? err.message : err)); } catch (_) {}
    return { text, stop: false };
  }
};

modifier(text);
