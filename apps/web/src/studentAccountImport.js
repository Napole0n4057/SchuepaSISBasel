function parseYear(value) {
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export function parseUsersFromText(rawText) {
  const users = [];

  for (const line of rawText.trim().split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.includes("\t")) {
      const [name, email, password, programme, year] = trimmed
        .split("\t")
        .map((value) => value.trim());
      if (email && password) {
        users.push({ name: name || undefined, email, password, programme, year: parseYear(year || "") });
      }
      continue;
    }

    if (trimmed.includes(",")) {
      const [name, email, password, programme, year] = trimmed
        .split(",")
        .map((value) => value.trim());
      if (email && password) {
        users.push({ name: name || undefined, email, password, programme, year: parseYear(year || "") });
      }
      continue;
    }

    const [email, password, programme, year] = trimmed.split(/\s+/, 4);
    if (email && password) {
      users.push({ email, password, programme, year: parseYear(year || "") });
    }
  }

  return users;
}
