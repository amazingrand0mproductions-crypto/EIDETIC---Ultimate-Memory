const modifier = (text) => {
  try {
    const result = EIDETIC("output", text) || {};
    let out = result.text === undefined ? text : result.text;
    if (out === "") out = text || " ";
    return { text: out, stop: !!result.stop };
  } catch (err) {
    try { log("EIDETIC Output fallback: " + (err && err.message ? err.message : err)); } catch (_) {}
    return { text: text || " ", stop: false };
  }
};

modifier(text);
