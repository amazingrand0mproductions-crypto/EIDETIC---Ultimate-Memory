const modifier = (text) => {
  const result = EIDETIC("input", text);
  return { text: result.text, stop: result.stop };
};

modifier(text);
