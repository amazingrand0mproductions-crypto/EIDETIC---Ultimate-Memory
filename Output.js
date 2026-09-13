const modifier = (text) => {
  const result = EIDETIC("output", text);
  return { text: result.text, stop: result.stop };
};

modifier(text);
