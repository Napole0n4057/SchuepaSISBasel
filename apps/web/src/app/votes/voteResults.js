export function matchesVoteClass(vote, selectedClass) {
  if (!selectedClass) return true;

  const classNames = Array.isArray(vote?.class_names) ? vote.class_names : [];
  return classNames.length === 0 || classNames.includes(selectedClass);
}

export function calculateVoteResults(options = []) {
  const normalizedOptions = options.map((option) => {
    const parsedCount = Number.parseInt(option.vote_count, 10);
    return {
      ...option,
      count: Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0,
    };
  });
  const totalVotes = normalizedOptions.reduce((total, option) => total + option.count, 0);
  const highestCount = Math.max(0, ...normalizedOptions.map((option) => option.count));
  const leaders = totalVotes > 0
    ? normalizedOptions.filter((option) => option.count === highestCount)
    : [];

  return {
    totalVotes,
    tied: leaders.length > 1,
    winner: leaders.length === 1 ? leaders[0] : null,
    options: normalizedOptions.map((option) => ({
      ...option,
      percentage: totalVotes > 0 ? (option.count / totalVotes) * 100 : 0,
    })),
  };
}

export function formatSwissDeadline(value, language = "de") {
  if (!value) return null;

  const rawValue = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawValue);
  const date = new Date(hasTimezone ? rawValue : `${rawValue}Z`);
  if (!Number.isFinite(date.getTime())) return null;

  return new Intl.DateTimeFormat(language === "de" ? "de-CH" : "en-GB", {
    timeZone: "Europe/Zurich",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
