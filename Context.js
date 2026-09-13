// @cache-compatible
const modifier = (text) => {
  const result = EIDETIC("contextAppend", text);
  return { text: result.text, stop: result.stop };
};

modifier(text);
