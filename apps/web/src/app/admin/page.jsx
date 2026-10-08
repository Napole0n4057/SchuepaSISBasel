import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import { messageKeyFromError, useLanguage } from "@/i18n";

function parseUsersFromText(rawText) {
  const lines = rawText.trim().split("\n");
  const users = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Supported formats:
    // 1) Name, email@sis.ch, password
    // 2) Name<TAB>email@sis.ch<TAB>password
    // 3) email@sis.ch password
    if (trimmed.includes("\t")) {
      const [name, email, password] = trimmed
        .split("\t")
        .map((value) => value.trim());
      if (email && password) {
        users.push({ name: name || undefined, email, password });
      }
      continue;
    }

    if (trimmed.includes(",")) {
      const [name, email, password] = trimmed
        .split(",")
        .map((value) => value.trim());
      if (email && password) {
        users.push({ name: name || undefined, email, password });
      }
      continue;
    }

    const [email, password] = trimmed.split(/\s+/, 2);
    if (email && password) {
      users.push({ email, password });
    }
  }

  return users;
}

export default function AdminPage() {
  const { data: user, loading: userLoading } = useUser();
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [bulkImportText, setBulkImportText] = useState("");
  const [bulkResults, setBulkResults] = useState(null);
  const [importFileName, setImportFileName] = useState("");

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
      if (!roleRes.ok || !roleData.role) {
        throw new Error(roleData.error || "Failed to load current user role");
      }

      setCurrentUserRole(roleData.role);

      if (
        roleData.role.designation !== "admin" &&
        roleData.role.designation !== "spectator"
      ) {
        setError("Only admins and spectators can access this page");
        setLoading(false);
        return;
      }

      // Fetch all users
      const usersRes = await fetch("/api/user-roles/list");
      const usersData = await usersRes.json();
      if (!usersRes.ok) {
        throw new Error(usersData.error || "Failed to load users");
      }

      setUsers(usersData.users || []);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Error loading user data");
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newDesignation) => {
    try {
      setError(null);
      setSuccess(null);

      if (currentUserRole?.designation !== "admin") {
        throw new Error("Admin access required");
      }

      const res = await fetch("/api/user-roles/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, designation: newDesignation }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      setSuccess("Role updated successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Error updating role");
    }
  };

  const handleResetPassword = async (userId, email) => {
    try {
      setError(null);
      setSuccess(null);

      const newPassword = window.prompt(
        t("New password for {email}", { email }),
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

      setSuccess({ key: "Password reset for {email}", values: { email } });
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Error resetting password"));
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

      const usersList = parseUsersFromText(bulkImportText);

      if (usersList.length === 0) {
        throw new Error("No valid users found");
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
      setSuccess({
        key: "Bulk import complete: {created} created, {skipped} skipped, {errors} errors",
        values: {
          created: data.summary.created,
          skipped: data.summary.skipped,
          errors: data.summary.errors,
        },
      });
      setBulkImportText("");
      setImportFileName("");
      fetchData();
    } catch (err) {
      console.error(err);
      setError(messageKeyFromError(err.message, "Bulk import failed"));
    }
  };

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setBulkImportText(text);
      setImportFileName(file.name);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Could not read file");
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
          <p className="mb-4 text-lg text-gray-600">
            {t("Please sign in")}
          </p>
          <a
            href="/account/signin"
            className="text-gray-900 hover:text-gray-700 font-medium"
          >
            {t("Go to sign in")}
          </a>
        </div>
      </div>
    );
  }

  const isAdmin = currentUserRole?.designation === "admin";
  const isSpectator = currentUserRole?.designation === "spectator";
  const hasAdminAccess = isAdmin || isSpectator;

  if (!hasAdminAccess) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center bg-gray-50 p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg border border-gray-200">
          <div className="mb-8 flex justify-center">
              <a href="/" aria-label={t("Home")}>
              <img
                src="/sis-student-parliament-logo.png"
                alt={t("SIS Basel logo")}
                className="h-24 w-auto"
              />
            </a>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            {t("Access denied")}
          </h1>
          <p className="mb-6 text-gray-600">
            {t("Only admins and spectators can access this page")}
          </p>
          {error && (
            <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
              {t(error)}
            </div>
          )}
          <a
            href="/"
            className="inline-block rounded-md bg-gray-900 px-6 py-3 text-base font-medium text-white hover:bg-gray-800"
          >
            {t("Back to home")}
          </a>
        </div>
      </div>
    );
  }

  // Filter users based on search
  const filteredUsers = users.filter((u) =>
    `${u.name || ""} ${u.email}`.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="app-page min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" aria-label={t("Home")}>
              <img
                src="/sis-student-parliament-logo.png"
                alt={t("SIS Basel logo")}
                className="h-16 w-auto"
              />
            </a>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t("Administration")}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {isSpectator ? t("Spectator") : t("Administrator")}{" "}
                - {user.email}
              </p>
            </div>
          </div>
          <a
            href="/account/logout"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {t("Log out")}
          </a>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600">
            {t(error)}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-600">
            {typeof success === "string" ? t(success) : t(success.key, success.values)}
          </div>
        )}

        {isSpectator && (
          <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-600">
            {t("You can view everything, but only admins can make changes.")}
          </div>
        )}

        {/* Users Management */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {t("User management")}
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search...")}
              className="rounded-md border border-gray-300 px-4 py-2 w-64 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    {t("Name")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    {t("Email")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    {t("Role")}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                    {t("Actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {u.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {u.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          u.designation === "admin"
                            ? "bg-blue-100 text-blue-900"
                            : u.designation === "spectator"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {u.designation === "admin"
                          ? t("Admin")
                          : u.designation === "spectator"
                          ? t("Spectator")
                          : t("Member")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {isAdmin ? (
                          <select
                            value={u.designation}
                            onChange={(e) =>
                              handleRoleChange(u.user_id, e.target.value)
                            }
                            className="rounded-md border border-gray-300 px-3 py-1 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                          >
                            <option value="member">{t("Member")}</option>
                            <option value="admin">{t("Admin")}</option>
                            <option value="spectator">
                              {t("Spectator")}
                            </option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {t("Read only")}
                          </span>
                        )}
                        {isAdmin && u.designation === "member" && (
                          <button
                            onClick={() => handleResetPassword(u.user_id, u.email)}
                            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-900 hover:bg-gray-50"
                          >
                            {t("Reset password")}
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
                {t("No users found")}
              </p>
            )}
          </div>
        </div>

        {/* Bulk Import (Admin only) */}
        {isAdmin && (
          <div className="mb-8 rounded-lg bg-white p-6 shadow-md border border-gray-200">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {t("Import accounts")}
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              {t("Format A (recommended):")}{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                Max Muster, max@sisbasel.ch, Password123!
              </code>
              <br />
              {t("Format B (legacy):")}{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                email@sisbasel.ch password123
              </code>
            </p>
            <form onSubmit={handleBulkImport} className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50">
                  {t("Choose .txt file")}
                  <input
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleImportFileChange}
                    className="hidden"
                  />
                </label>
                {importFileName ? (
                  <span className="text-sm text-gray-600">{importFileName}</span>
                ) : null}
              </div>
              <textarea
                value={bulkImportText}
                onChange={(e) => setBulkImportText(e.target.value)}
                placeholder={t("Bulk import examples")}
                rows={8}
                className="w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {t("Import accounts")}
              </button>
            </form>

            {bulkResults && (
              <div className="mt-6 space-y-4">
                <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    {t("Summary")}
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>{t("Total: {count}", { count: bulkResults.summary.total })}</li>
                    <li>{t("Created: {count}", { count: bulkResults.summary.created })}</li>
                    <li>{t("Skipped: {count}", { count: bulkResults.summary.skipped })}</li>
                    <li>{t("Errors: {count}", { count: bulkResults.summary.errors })}</li>
                  </ul>
                </div>

                {bulkResults.results.errors.length > 0 && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-4">
                    <h3 className="font-semibold text-red-900 mb-2">
                      {t("Errors")}
                    </h3>
                    <ul className="text-sm text-red-800 space-y-1">
                      {bulkResults.results.errors.map((err, idx) => (
                        <li key={idx}>
                          {err.email}: {t(messageKeyFromError(err.reason, "Something went wrong"))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {bulkResults.results.skipped.length > 0 && (
                  <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                    <h3 className="font-semibold text-yellow-900 mb-2">
                      {t("Skipped")}
                    </h3>
                    <ul className="text-sm text-yellow-800 space-y-1">
                      {bulkResults.results.skipped.map((skip, idx) => (
                        <li key={idx}>
                          {skip.email}: {t(messageKeyFromError(skip.reason, "Something went wrong"))}
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
