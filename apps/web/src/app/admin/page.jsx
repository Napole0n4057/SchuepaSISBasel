import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function AdminPage() {
  const { data: user, loading: userLoading } = useUser();
  const [users, setUsers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkResults, setBulkResults] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!userLoading && user) {
      fetchData();
    } else if (!userLoading && !user) {
      setLoading(false);
    }
  }, [user, userLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch current user role
      const roleRes = await fetch("/api/user-roles/get");
      const roleData = await roleRes.json();
      setCurrentUserRole(roleData.role);

      if (
        roleData.role.designation !== "admin" &&
        roleData.role.designation !== "spectator"
      ) {
        setError(
          "Zugriff verweigert - Nur für Administratoren und Zuschauer / Access denied - Admin or Spectator only",
        );
        setLoading(false);
        return;
      }

      // Fetch all users
      const usersRes = await fetch("/api/user-roles/list");
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden der Daten / Error loading data");
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newDesignation) => {
    try {
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/user-roles/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, designation: newDesignation }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      setSuccess("Rolle erfolgreich aktualisiert / Role updated successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Fehler beim Aktualisieren der Rolle / Error updating role");
    }
  };

  const handleResetPassword = async (userId, email) => {
    try {
      setError(null);
      setSuccess(null);

      const newPassword = window.prompt(
        `Neues Passwort für ${email} / New password for ${email}`,
      );

      if (!newPassword) return;

      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }

      setSuccess(
        `Passwort zurückgesetzt / Password reset: ${email}`,
      );
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Fehler beim Zurücksetzen / Error resetting password",
      );
    }
  };

  // Removed: create-user, allowed-emails, and student-accounts handlers

  const handleBulkImport = async (e) => {
    e.preventDefault();
    if (!bulkImportText.trim()) return;

    try {
      setError(null);
      setSuccess(null);
      setBulkResults(null);

      // Parse space-separated: email password per line
      const lines = bulkImportText.trim().split("\n");
      const usersList = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue; // skip empty or comment lines

        // Split by first space only
        const spaceIndex = trimmed.indexOf(" ");
        if (spaceIndex === -1) continue;

        const email = trimmed.substring(0, spaceIndex).trim();
        const password = trimmed.substring(spaceIndex + 1).trim();

        if (email && password) {
          usersList.push({ email, password });
        }
      }

      if (usersList.length === 0) {
        throw new Error(
          "Keine gültigen Benutzer gefunden / No valid users found",
        );
      }

      const res = await fetch("/api/users/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: usersList }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to bulk import");
      }

      setBulkResults(data);
      setSuccess(
        `Massenimport abgeschlossen / Bulk import complete: ${data.summary.created} erstellt / created, ${data.summary.skipped} übersprungen / skipped, ${data.summary.errors} Fehler / errors`,
      );
      setBulkImportText("");
      fetchData();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Fehler beim Massenimport / Error during bulk import",
      );
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

  const isAdmin = currentUserRole?.designation === "admin";
  const isSpectator = currentUserRole?.designation === "spectator";

  // Filter users based on search
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" aria-label="Zur Startseite / Back to Home">
              <img
                src="https://theinternationalschools.com/ch/wp-content/uploads/sites/7/2021/11/sis-basel-logo-the-international-schools-group-switzerland-TISG.png.webp"
                alt="SIS Basel Logo"
                className="h-16 w-auto mix-blend-multiply"
              />
            </a>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Verwaltung / Administration
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isSpectator
                  ? "Zuschauer / Spectator"
                  : "Administrator / Admin"}{" "}
                - {user.email}
              </p>
            </div>
          </div>
          <a
            href="/account/logout"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Abmelden / Logout
          </a>
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

        {isSpectator && (
          <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-600">
            Sie sind Zuschauer - Sie können alles sehen, aber nur
            Administratorenrechte verwalten / You are a spectator - You can view
            everything but only manage admin rights
          </div>
        )}

        {/* Users Management */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Benutzerverwaltung / User Management
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suche... / Search..."
              className="rounded-md border border-gray-300 px-4 py-2 w-64 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    E-Mail / Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    Rolle / Role
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    Aktionen / Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          u.designation === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : u.designation === "spectator"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {u.designation === "admin"
                          ? "Admin"
                          : u.designation === "spectator"
                            ? "Zuschauer / Spectator"
                            : "Mitglied / Member"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={u.designation}
                          onChange={(e) =>
                            handleRoleChange(u.user_id, e.target.value)
                          }
                          className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                        >
                          <option value="member">Mitglied / Member</option>
                          <option value="admin">Admin</option>
                          <option value="spectator">Zuschauer / Spectator</option>
                        </select>
                        {isAdmin && u.designation === "member" && (
                          <button
                            onClick={() => handleResetPassword(u.user_id, u.email)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-gray-50"
                          >
                            Passwort zurücksetzen / Reset
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p className="text-center py-8 text-gray-500 text-sm">
                Keine Benutzer gefunden / No users found
              </p>
            )}
          </div>
        </div>

        {/* Bulk Import (Admin only) */}
        {isAdmin && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Import Accounts / Konten importieren
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Format: Eine Zeile pro Benutzer:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                email@sisbasel.ch password123
              </code>
              <br />
              Format: One line per user:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                email@sisbasel.ch password123
              </code>
            </p>
            <form onSubmit={handleBulkImport} className="space-y-4">
              <textarea
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder="user1@sisbasel.ch password123&#10;user2@sisbasel.ch password456&#10;user3@sisbasel.ch password789"
                rows={8}
                className="w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Import Accounts / Konten importieren
              </button>
            </form>

            {bulkResults && (
              <div className="mt-6 space-y-4">
                <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Zusammenfassung / Summary
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>Gesamt / Total: {bulkResults.summary.total}</li>
                    <li>Erstellt / Created: {bulkResults.summary.created}</li>
                    <li>
                      Übersprungen / Skipped: {bulkResults.summary.skipped}
                    </li>
                    <li>Fehler / Errors: {bulkResults.summary.errors}</li>
                  </ul>
                </div>

                {bulkResults.results.errors.length > 0 && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-4">
                    <h3 className="font-semibold text-red-900 mb-2">
                      Fehler / Errors
                    </h3>
                    <ul className="text-sm text-red-800 space-y-1">
                      {bulkResults.results.errors.map((err, idx) => (
                        <li key={idx}>
                          {err.email}: {err.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bulkResults.results.skipped.length > 0 && (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                    <h3 className="font-semibold text-yellow-900 mb-2">
                      Übersprungen / Skipped
                    </h3>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {bulkResults.results.skipped.map((skip, idx) => (
                        <li key={idx}>
                          {skip.email}: {skip.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
