export function mergeBrokenProductLines(lines) {
  const merged = [];
  let buffer = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;

    // Quantity at end → likely complete product
    const hasQty = /\b\d{1,5}\b$/.test(line);

    // Looks like product text
    const looksLikeProduct =
      /tab|cap|syr|inj|cream|gel|mg|ml|mcg|iu/i.test(line);

    if (buffer) {
      // Try merging buffer + current line
      const combined = `${buffer} ${line}`;

      if (/\b\d{1,5}\b$/.test(combined)) {
        merged.push(combined);
        buffer = "";
        continue;
      } else {
        buffer = combined;
        continue;
      }
    }

    if (!hasQty && looksLikeProduct) {
      buffer = line;
    } else {
      merged.push(line);
    }
  }

  if (buffer) merged.push(buffer);

  return merged;
}
