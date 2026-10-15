import { useEffect, useMemo, useState } from "react";
import useUser from "@/utils/useUser";
import { useLanguage } from "@/i18n";

const PROGRAMMES = ["Gym", "Int"];
const YEARS = [1, 2, 3, 4, 5, 6];

export default function StudentClassesPage() {
  const { data: user, loading: userLoading } = useUser();
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [edits, setEdits] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadStudents();
  }, [user, userLoading]);

  async function loadStudents() {
    try {
      setLoading(true);
      const response = await fetch("/api/student-classes/list");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load student classes");
      setStudents(data.students || []);
      setEdits(Object.fromEntries((data.students || []).map((student) => [
        student.user_id,
        { programme: student.programme || "", year: student.year ?? "" },
      ])));
      setError(null);
    } catch {
      setError("Could not load student classes");
    } finally {
      setLoading(false);
    }
  }

  const filteredStudents = useMemo(() => students.filter((student) =>
    `${student.name || ""} ${student.email || ""} ${student.programme || ""} ${student.year || ""}`
      .toLowerCase().includes(search.toLowerCase()),
  ), [students, search]);

  function changeField(userId, field, value) {
    setEdits((current) => ({
      ...current,
      [userId]: { ...current[userId], [field]: value },
    }));
    setRowMessages((current) => ({ ...current, [userId]: null }));
  }

  async function saveClass(userId) {
    const edit = edits[userId];
    setSaving((current) => ({ ...current, [userId]: true }));
    setRowMessages((current) => ({ ...current, [userId]: null }));
    try {
      const response = await fetch("/api/student-classes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...edit, userId, year: Number(edit.year) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save student class");
      setStudents((current) => current.map((student) => student.user_id === userId
        ? { ...student, programme: data.student.programme, year: data.student.year }
        : student));
      setRowMessages((current) => ({ ...current, [userId]: { success: true } }));
    } catch {
      setRowMessages((current) => ({ ...current, [userId]: { success: false } }));
    } finally {
      setSaving((current) => ({ ...current, [userId]: false }));
    }
  }

  if (userLoading || loading) {
    return <main className="app-page flex min-h-screen items-center justify-center bg-gray-50"><p>{t("Loading...")}</p></main>;
  }

  if (!user || error) {
    return (
      <main className="app-page flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="max-w-lg rounded-lg border border-gray-200 bg-white p-8 text-center shadow">
          <h1 className="mb-3 text-2xl font-bold text-gray-900">{t("Student class management")}</h1>
          <p className="mb-5 text-gray-600">{t(error || "Please sign in")}</p>
          <a href={user ? "/admin" : "/account/signin"} className="font-medium text-gray-900 underline">
            {t(user ? "Back to administration" : "Go to sign in")}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page min-h-screen bg-gray-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("Student class management")}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600">{t("Class rollover explanation")}</p>
          </div>
          <a href="/admin" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100">
            {t("Back to administration")}
          </a>
        </header>

        {error && <p role="alert" className="mb-5 rounded-md bg-red-50 p-4 text-sm text-red-700">{t(error)}</p>}

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-900">{t("Students")}</h2>
            <label className="sr-only" htmlFor="student-search">{t("Search students")}</label>
            <input
              id="student-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Search students")}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-72"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  {["Name", "Email", "Programme", "Year", "Actions"].map((heading) => (
                    <th key={heading} scope="col" className="px-3 py-3 text-left text-sm font-semibold text-gray-900">{t(heading)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const edit = edits[student.user_id] || { programme: "", year: "" };
                  const saved = edit.programme === student.programme && Number(edit.year) === student.year;
                  return (
                    <tr key={student.user_id}>
                      <td className="px-3 py-3 text-sm text-gray-900">{student.name || "—"}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">{student.email}</td>
                      <td className="px-3 py-3">
                        <label className="sr-only" htmlFor={`programme-${student.user_id}`}>{t("Programme for {name}", { name: student.name || student.email })}</label>
                        <select id={`programme-${student.user_id}`} value={edit.programme} onChange={(event) => changeField(student.user_id, "programme", event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                          <option value="">{t("Select programme")}</option>
                          {PROGRAMMES.map((programme) => <option key={programme} value={programme}>{programme}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <label className="sr-only" htmlFor={`year-${student.user_id}`}>{t("Year for {name}", { name: student.name || student.email })}</label>
                        <select id={`year-${student.user_id}`} value={edit.year} onChange={(event) => changeField(student.user_id, "year", event.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
                          <option value="">{t("Select year")}</option>
                          {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
                        </select>
                        {student.year === 6 && <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">{t("Graduation review")}</span>}
                        {!student.year && <span className="ml-2 text-xs text-amber-800">{t("Class not assigned")}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => saveClass(student.user_id)}
                          disabled={!edit.programme || !edit.year || saved || saving[student.user_id]}
                          className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving[student.user_id] ? t("Saving...") : t("Save class")}
                        </button>
                        {rowMessages[student.user_id]?.success && <p role="status" className="mt-1 text-xs text-green-700">{t("Class saved")}</p>}
                        {rowMessages[student.user_id]?.success === false && <p role="alert" className="mt-1 text-xs text-red-700">{t("Could not save student class")}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredStudents.length === 0 && <p className="py-8 text-center text-sm text-gray-500">{t("No students found")}</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
