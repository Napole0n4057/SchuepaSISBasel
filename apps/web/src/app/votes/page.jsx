import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function VotesPage() {
  const { data: user, loading: userLoading } = useUser();
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Create vote state (for admins)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newOptions, setNewOptions] = useState(["", ""]);
  const [adminOnly, setAdminOnly] = useState(false);

  useEffect(() => {
    if (!userLoading && user) {
      fetchUserRole();
      fetchVotes();
    }
  }, [user, userLoading]);

  const fetchUserRole = async () => {
    try {
      const res = await fetch("/api/user-roles/get");
      const data = await res.json();
      setUserRole(data.role);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVotes = async () => {
    try {
      const res = await fetch("/api/votes/list");
      const data = await res.json();
      setVotes(data.votes || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden der Abstimmungen / Error loading votes");
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cast vote");
      }

      setSuccess("Stimme abgegeben / Vote cast");
      fetchVotes();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleCreateVote = async (e) => {
    e.preventDefault();

    const filteredOptions = newOptions.filter((o) => o.trim() !== "");

    if (!newTitle.trim() || filteredOptions.length < 2) {
      setError(
        "Titel und mindestens 2 Optionen erforderlich / Title and at least 2 options required",
      );
      return;
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
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create vote");
      }

      setSuccess("Abstimmung erstellt / Vote created");
      setShowCreateForm(false);
      setNewTitle("");
      setNewDescription("");
      setNewOptions(["", ""]);
      setAdminOnly(false);
      fetchVotes();
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <p className="text-lg text-gray-600">Lädt... / Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="text-center">
          <p className="mb-4 text-lg text-gray-600">
            Bitte melden Sie sich an / Please sign in
          </p>
          <a
            href="/account/signin"
            className="text-gray-900 hover:text-gray-700 font-medium"
          >
            Zur Anmeldung / Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  const isAdmin = userRole?.designation === "admin";
  const isSpectator = userRole?.designation === "spectator";

  return (
    <div className="min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Abstimmungen / Votes
            </h1>
            <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Zurück zur Startseite / Back to Home
            </a>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {showCreateForm
                ? "Abbrechen / Cancel"
                : "Abstimmung erstellen / Create Vote"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-600">
            {success}
          </div>
        )}

        {/* Create Vote Form */}
        {isAdmin && showCreateForm && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Neue Abstimmung / New Vote
            </h2>
            <form onSubmit={handleCreateVote} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Titel / Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Beschreibung / Description
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Optionen / Options *
                </label>
                {newOptions.map((option, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const updated = [...newOptions];
                        updated[idx] = e.target.value;
                        setNewOptions(updated);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    {newOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewOptions(newOptions.filter((_, i) => i !== idx))
                        }
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setNewOptions([...newOptions, ""])}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  + Option hinzufügen / Add option
                </button>
              </div>

              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={adminOnly}
                    onChange={(e) => setAdminOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    Nur für Admins sichtbar / Admin only
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
              >
                Abstimmung erstellen / Create Vote
              </button>
            </form>
          </div>
        )}

        {/* Votes List */}
        <div className="space-y-6">
          {votes.map((vote) => {
            const totalVotes = vote.options.reduce(
              (sum, opt) => sum + parseInt(opt.vote_count),
              0,
            );
            const hasVoted = vote.user_voted_option_id !== null;
            const isEnded = vote.ends_at && new Date(vote.ends_at) < new Date();

            return (
              <div
                key={vote.id}
                className="rounded-lg bg-white p-6 shadow-md border border-gray-200"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {vote.title}
                    </h3>
                    {vote.admin_only && (
                      <span className="rounded-full bg-purple-100 text-purple-800 px-3 py-1 text-xs font-semibold">
                        Admin Only
                      </span>
                    )}
                  </div>
                  {vote.description && (
                    <p className="text-sm text-gray-600 mb-2">
                      {vote.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {totalVotes} {totalVotes === 1 ? "Stimme" : "Stimmen"} /{" "}
                    {totalVotes === 1 ? "Vote" : "Votes"}
                    {isEnded && (
                      <span className="ml-2 text-red-600">
                        • Beendet / Ended
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  {vote.options.map((option) => {
                    const percentage =
                      totalVotes > 0
                        ? (parseInt(option.vote_count) / totalVotes) * 100
                        : 0;
                    const isSelected = vote.user_voted_option_id === option.id;

                    return (
                      <div key={option.id}>
                        <button
                          onClick={() =>
                            !isSpectator &&
                            !isEnded &&
                            handleCastVote(vote.id, option.id)
                          }
                          disabled={isSpectator || isEnded}
                          className={`w-full text-left rounded-md border-2 px-4 py-3 transition-colors ${
                            isSelected
                              ? "border-gray-900 bg-gray-50"
                              : "border-gray-200 hover:border-gray-300"
                          } ${isSpectator || isEnded ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900">
                              {option.option_text}
                              {isSelected && (
                                <span className="ml-2 text-gray-600">✓</span>
                              )}
                            </span>
                            <span className="text-sm text-gray-600">
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-900 transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {option.vote_count}{" "}
                            {option.vote_count === "1" ? "Stimme" : "Stimmen"}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {isSpectator && (
                  <p className="mt-4 text-xs text-gray-500 italic">
                    Als Zuschauer können Sie nicht abstimmen / As spectator you
                    cannot vote
                  </p>
                )}
              </div>
            );
          })}

          {votes.length === 0 && (
            <div className="rounded-lg bg-white p-12 shadow-md border border-gray-200 text-center">
              <p className="text-gray-500">
                Keine Abstimmungen verfügbar / No votes available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
