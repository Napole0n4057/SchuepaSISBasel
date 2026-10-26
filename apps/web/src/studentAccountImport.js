// CSV/TSV: name, email, password, canonical class (optional).
// Whitespace: email password followed by the complete canonical class name.
// Legacy programme/year pairs are preserved as invalid text for explicit review.
export function parseUsersFromText(rawText) {
  return rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .flatMap((line) => {
      const separator = line.includes("\t")
        ? "\t"
        : line.includes(",")
          ? ","
          : null;
      let name, email, password, className;
      if (separator) {
      const parts = line.split(separator).map((part) => part.trim());
        [name, email, password] = parts;
        className = parts.slice(3).filter(Boolean).join(" ");
      } else {
        [email, password, ...className] = line.split(/\s+/);
        className = className.join(" ");
      }
      return email && password
        ? [
            {
              ...(name ? { name } : {}), email, password,
              class_name: className || null,
            },
          ]
        : [];
    });
      }
