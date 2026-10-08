import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Trophy } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import useUser from "@/utils/useUser";
import { messageKeyFromError, useLanguage } from "@/i18n";
import {
  calculateVoteResults,
  formatSwissDeadline,
  matchesVoteClass,
} from "./voteResults";

const ALLOWED_CLASSES = [
  "S1",
  "S2",
  "G1",
  "G2",
  "G3",
  "G4",
  "Pre-IB 1",
  "Pre-IB 2",
  "IBDP 1",
  "IBDP 2",
  "IB 1",
  "IB 2",
];

const RESULT_COLORS = ["#093388", "#009EE0", "#4c77bd", "#62c5ed", "#7f9ac6", "#a6def3"];

const SWISS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getSwissDateTimeParts(instant) {
  return Object.fromEntries(
    SWISS_DATE_TIME_FORMATTER.formatToParts(new Date(instant))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function getSwissUtcOffsetMinutes(instant) {
  const parts = getSwissDateTimeParts(instant);
  const swissWallTimeAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((swissWallTimeAsUtc - instant) / 60000);
}

function swissLocalDateTimeToIso(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) throw new Error("Invalid Swiss local date/time");

  const [, year, month, day, hour, minute] = match;
  const target = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: 0,
  };
  const wallTimeAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
  );
  const offsets = new Set(
    [-36, 0, 36].map((hours) =>
      getSwissUtcOffsetMinutes(wallTimeAsUtc + hours * 60 * 60 * 1000),
    ),
  );
  const matchingInstants = [...offsets]
    .map((offset) => wallTimeAsUtc - offset * 60 * 1000)
    .filter((instant) => {
      const parts = getSwissDateTimeParts(instant);
      return Object.keys(target).every((key) => parts[key] === target[key]);
    })
    .sort((left, right) => left - right);

  if (matchingInstants.length === 0) throw new Error("Invalid Swiss local date/time");

  // If the clock repeats during the autumn change, choose the first occurrence.
  const instant = matchingInstants[0];
  const offset = getSwissUtcOffsetMinutes(instant);
  const sign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absoluteOffset % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:00${sign}${offsetHours}:${offsetMinutes}`;
}

export default function VotesPage() {
  const { data: user, loading: userLoading } = useUser();
  const { language, t } = useLanguage();
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [classFilter, setClassFilter] = useState("");
  const [showPastVotes, setShowPastVotes] = useState(false);
  const [selectedResultVoteId, setSelectedResultVoteId] = useState(null);

  // Create vote state (for admins)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [adminOnly, setAdminOnly] = useState(false);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
      fetchVotes();
    }
  }, [user, userLoading]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/user-roles/get");
      if (!res.ok) throw new Error("Could not load data");
      const data = await res.json();
      setUserRole(data.role);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVotes = async () => {
    try {
      const res = await fetch("/api/votes/list");
      if (!res.ok) throw new Error("Error loading votes");
      const data = await res.json();
      setVotes(Array.isArray(data.votes) ? data.votes : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Error loading votes");
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async (voteId, optionId) => {
    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/votes/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_id: voteId, option_id: optionId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to cast vote");

      await fetchVotes();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Failed to vote"));
    }
  };

  const handleCreateVote = async (event) => {
    event.preventDefault();
    const filteredOptions = newOptions.filter((option) => option.trim() !== "");

    if (!newTitle.trim() || filteredOptions.length < 2) {
      setError("Title and at least 2 options are required");
      return;
    }

    let endsAt = null;
    if (newEndsAt) {
      try {
        endsAt = swissLocalDateTimeToIso(newEndsAt);
      } catch {
        setError("Invalid Swiss local date/time");
        return;
      }
    }

    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/votes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          options: filteredOptions,
          admin_only: adminOnly,
          ends_at: endsAt,
          class_names: selectedClasses,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create vote");

      setSuccess("Vote created");
      setShowCreateForm(false);
      setNewTitle("");
      setNewDescription("");
      setNewEndsAt("");
      setNewOptions(["", ""]);
      setSelectedClasses([]);
      setAdminOnly(false);
      await fetchVotes();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Something went wrong"));
    }
  };

  const handleDeleteVote = async (vote) => {
    const confirmed = window.confirm(
      t("Delete vote confirmation", { title: vote.title }),
    );
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);
      const res = await fetch("/api/votes/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote_id: vote.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(messageKeyFromError(data.error, "Could not delete vote"));
      }

      setSelectedResultVoteId(null);
      await fetchVotes();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Could not delete vote"));
    }
  };

  if (userLoading || loading) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">{t("Loading...")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-600">{t("Please sign in")}</p>
          <a href="/account/signin" className="font-medium text-gray-900 hover:text-gray-700">
            {t("Go to sign in")}
          </a>
        </div>
      </div>
    );
  }

  const isAdmin = userRole?.designation === "admin";
  const isSpectator = userRole?.designation === "spectator";
  const isPastVote = (vote) =>
    vote.status === "past" ||
    (vote.status !== "active" &&
      (vote.is_active === false ||
        (vote.ends_at && new Date(vote.ends_at).getTime() <= Date.now())));
  const activeVotes = votes.filter((vote) => !isPastVote(vote));
  const pastVotes = votes.filter(isPastVote);
  const filteredActiveVotes = activeVotes.filter((vote) => matchesVoteClass(vote, classFilter));
  const filteredPastVotes = pastVotes.filter((vote) => matchesVoteClass(vote, classFilter));
  const selectedResultVote = pastVotes.find((vote) => vote.id === selectedResultVoteId);

  const renderClassLabels = (vote) => {
    const classNames = Array.isArray(vote.class_names) ? vote.class_names : [];
    if (classNames.length === 0) {
      return (
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900">
          {t("School-wide")}
        </span>
      );
    }

    return classNames.map((className) => (
      <span
        key={className}
        className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-900"
      >
        {className}
      </span>
    ));
  };

  const renderDeleteButton = (vote) => isAdmin && (
    <button
      type="button"
      onClick={() => handleDeleteVote(vote)}
      aria-label={t("Delete vote {title}", { title: vote.title })}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
      {t("Delete")}
    </button>
  );

  const renderVoteCard = (vote) => {
    const totalVotes = calculateVoteResults(vote.options || []).totalVotes;
    const deadline = !isPastVote(vote) ? formatSwissDeadline(vote.ends_at, language) : null;

    return (
      <article key={vote.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-xl font-bold text-gray-900">{vote.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              {vote.admin_only && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">
                  {t("Admin only")}
                </span>
              )}
              {renderDeleteButton(vote)}
            </div>
          </div>
          {vote.description && <p className="mb-3 text-sm text-gray-600">{vote.description}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-500">
            <span>{t("Total votes: {count}", { count: totalVotes })}</span>
            {deadline && <span>{t("Ends {date} (Swiss time)", { date: deadline })}</span>}
            {isPastVote(vote) && <span className="font-semibold text-blue-900">{t("Vote ended")}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{renderClassLabels(vote)}</div>
        </div>

        <div className="space-y-3">
          {(vote.options || []).map((option) => {
            const optionCount = Number.parseInt(option.vote_count, 10) || 0;
            const percentage = totalVotes > 0 ? (optionCount / totalVotes) * 100 : 0;
            const isSelected = vote.user_voted_option_id === option.id;

            return (
              <div key={option.id}>
                <button
                  type="button"
                  onClick={() => !isSpectator && !isPastVote(vote) && handleCastVote(vote.id, option.id)}
                  disabled={isSpectator || isPastVote(vote)}
                  className={`w-full rounded-md border-2 px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-[#093388] bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  } ${isSpectator || isPastVote(vote) ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-semibold text-gray-900">
                      {option.option_text}
                      {isSelected && <span className="ml-2 text-blue-900">✓</span>}
                    </span>
                    <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-[#093388] transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {optionCount} {optionCount === 1 ? t("Vote") : t("Vote plural")}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {isSpectator && !isPastVote(vote) && (
          <p className="mt-4 text-xs italic text-gray-500">{t("You cannot vote as a spectator")}</p>
        )}
      </article>
    );
  };

  const renderResults = (vote) => {
    const results = calculateVoteResults(vote.options || []);
    const chartOptions = results.options.filter((option) => option.count > 0);

    return (
      <section aria-labelledby="vote-results-title" className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => setSelectedResultVoteId(null)}
              className="mb-4 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-blue-900 hover:bg-blue-50"
            >
              {t("Back to past votes")}
            </button>
            <h2 id="vote-results-title" className="text-2xl font-bold text-gray-900">{vote.title}</h2>
            {vote.description && <p className="mt-2 max-w-2xl text-sm text-gray-600">{vote.description}</p>}
          </div>
          {renderDeleteButton(vote)}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-900">{t("Vote ended")}</span>
          <span className="text-sm text-gray-600">{t("Total votes: {count}", { count: results.totalVotes })}</span>
        </div>

        {results.winner && (
          <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            <Trophy aria-hidden="true" className="h-4 w-4 text-[#009EE0]" />
            {t("Winner")}: {results.winner.option_text}
          </p>
        )}
        {results.tied && (
          <p className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            {t("Tied")}
          </p>
        )}

        {results.totalVotes === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
            <p className="font-semibold text-gray-800">{t("No votes")}</p>
            <p className="mt-1 text-sm text-gray-600">{t("No votes were cast in this vote.")}</p>
          </div>
        ) : (
          <div className="grid items-center gap-5 md:grid-cols-[minmax(220px,0.9fr)_1.1fr]">
            <div className="h-56 min-w-0 sm:h-64" role="img" aria-label={t("Vote distribution chart")}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartOptions}
                    dataKey="count"
                    nameKey="option_text"
                    innerRadius="42%"
                    outerRadius="78%"
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {chartOptions.map((option, index) => (
                      <Cell key={option.id || option.option_text} fill={RESULT_COLORS[index % RESULT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [t("Votes count: {count}", { count: value }), t("Vote plural")]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="space-y-3" aria-label={t("Results")}>
              {results.options.map((option, index) => (
                <li key={option.id || option.option_text} className="rounded-md border border-gray-200 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-gray-900">
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: RESULT_COLORS[index % RESULT_COLORS.length] }}
                      />
                      <span className="break-words">{option.option_text}</span>
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{option.percentage.toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 pl-5 text-sm text-gray-600">
                    {t("Votes count: {count}", { count: option.count })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="app-page min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-24">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">{t("Votes")}</h1>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">{t("Back to home")}</a>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded-md border border-[#06245f] bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {showCreateForm ? t("Cancel") : t("Create vote")}
            </button>
          )}
        </div>

        {error && <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t(error)}</div>}
        {success && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-md border border-green-200 bg-white p-3 text-sm text-green-700 shadow-lg"
          >
            {t(success)}
          </div>
        )}

        {isAdmin && showCreateForm && (
          <div className="mb-7 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-xl font-bold text-gray-900">{t("New vote")}</h2>
            <form onSubmit={handleCreateVote} className="space-y-5">
              <div>
                <label htmlFor="vote-title" className="mb-2 block text-sm font-semibold text-gray-900">{t("Title *")}</label>
                <input
                  id="vote-title"
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label htmlFor="vote-description" className="mb-2 block text-sm font-semibold text-gray-900">{t("Description")}</label>
                <textarea
                  id="vote-description"
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">{t("Classes (optional)")}</label>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("Classes (optional)")}>
                  <button
                    type="button"
                    aria-pressed={selectedClasses.length === 0}
                    onClick={() => setSelectedClasses([])}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      selectedClasses.length === 0
                        ? "border-[#093388] bg-[#093388] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-[#009EE0] hover:bg-blue-50"
                    }`}
                  >
                    {t("All classes (school-wide)")}
                  </button>
                  {ALLOWED_CLASSES.map((className) => {
                    const selected = selectedClasses.includes(className);
                    return (
                      <button
                        key={className}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedClasses((current) =>
                          selected
                            ? current.filter((name) => name !== className)
                            : [...current, className],
                        )}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                          selected
                            ? "border-[#093388] bg-[#093388] text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:border-[#009EE0] hover:bg-blue-50"
                        }`}
                      >
                        {className}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-gray-500">{t("No selected classes means the vote is school-wide.")}</p>
              </div>

              <div>
                <label htmlFor="vote-ends-at" className="mb-2 block text-sm font-semibold text-gray-900">{t("Deadline (Swiss local time)")}</label>
                <input
                  id="vote-ends-at"
                  type="datetime-local"
                  step="60"
                  value={newEndsAt}
                  onChange={(event) => setNewEndsAt(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
                <p className="mt-1 text-sm text-gray-500">{t("The selected time is interpreted in Switzerland (Europe/Zurich).")}</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">{t("Options *")}</label>
                {newOptions.map((option, index) => (
                  <div key={index} className="mb-2 flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(event) => {
                        const updated = [...newOptions];
                        updated[index] = event.target.value;
                        setNewOptions(updated);
                      }}
                      placeholder={t("Option {number}", { number: index + 1 })}
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    {newOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setNewOptions(newOptions.filter((_, optionIndex) => optionIndex !== index))}
                        aria-label={t("Remove option {number}", { number: index + 1 })}
                        className="rounded-md border border-gray-300 px-3 py-2 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewOptions([...newOptions, ""])}
                  className="rounded-md border border-transparent px-2 py-1 text-sm font-medium text-blue-900 hover:bg-blue-50"
                >
                  + {t("Add option")}
                </button>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={adminOnly}
                    onChange={(event) => setAdminOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-[#009EE0]"
                  />
                  <span className="text-sm font-semibold text-gray-900">{t("Admin only")}</span>
                </label>
              </div>

              <button type="submit" className="w-full rounded-md border border-[#06245f] bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800">
                {t("Create vote")}
              </button>
            </form>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:gap-4">
          <label htmlFor="vote-class-filter" className="mb-2 block text-sm font-semibold text-gray-900 sm:mb-0">{t("Filter by class")}</label>
          <select
            id="vote-class-filter"
            value={classFilter}
            onChange={(event) => {
              setClassFilter(event.target.value);
              setSelectedResultVoteId(null);
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 sm:max-w-xs"
          >
            <option value="">{t("All classes")}</option>
            {ALLOWED_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
        </div>

        {selectedResultVote ? (
          renderResults(selectedResultVote)
        ) : (
          <div className="space-y-7">
            <section aria-labelledby="active-votes-heading" className="space-y-4">
              <h2 id="active-votes-heading" className="text-2xl font-bold text-gray-900">{t("Active votes")}</h2>
              {filteredActiveVotes.length > 0 ? (
                <div className="space-y-4">{filteredActiveVotes.map(renderVoteCard)}</div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white p-7 text-center shadow-sm">
                  <p className="text-gray-500">{t("No active votes")}</p>
                </div>
              )}

              <button
                type="button"
                aria-expanded={showPastVotes}
                aria-controls="past-votes-archive"
                onClick={() => setShowPastVotes((show) => !show)}
                className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-50"
              >
                {showPastVotes ? t("Hide past votes") : t("View past votes")}
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-900">{filteredPastVotes.length}</span>
                {showPastVotes
                  ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
                  : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
              </button>
            </section>

            {showPastVotes && (
              <section id="past-votes-archive" aria-labelledby="past-votes-heading" className="space-y-3">
                <h2 id="past-votes-heading" className="text-xl font-bold text-gray-900">{t("Past votes")}</h2>
                {filteredPastVotes.length > 0 ? (
                  <div className="space-y-3">
                    {filteredPastVotes.map((vote) => (
                      <article key={vote.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <h3 className="break-words font-semibold text-gray-900">{vote.title}</h3>
                          {vote.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{vote.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-blue-900">{t("Vote ended")}</span>
                            {renderClassLabels(vote)}
                          </div>
                        </div>
                        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
                          <button
                            type="button"
                            onClick={() => setSelectedResultVoteId(vote.id)}
                            className="rounded-md border border-[#093388] px-3 py-2 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-50"
                          >
                            {t("View results")}
                          </button>
                          {renderDeleteButton(vote)}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">{t("No past votes")}</p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
