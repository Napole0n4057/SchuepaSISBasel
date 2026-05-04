import { useState } from "react";
import useAuth from "@/utils/useAuth";

export default function SignInPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Bitte alle Felder ausfüllen / Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const result = await signInWithCredentials({
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error) {
        throw new Error("CredentialsSignin");
      }

      const destination = result?.url || "/";
      window.location.href = destination;
    } catch (err) {
      const errorMessages = {
        OAuthSignin: "Anmeldung nicht möglich / Could not start sign-in",
        OAuthCallback: "Anmeldung fehlgeschlagen / Sign-in failed",
        OAuthCreateAccount:
          "Konto konnte nicht erstellt werden / Could not create account",
        EmailCreateAccount:
          "Diese E-Mail kann nicht verwendet werden / This email cannot be used",
        Callback: "Etwas ist schiefgelaufen / Something went wrong",
        OAuthAccountNotLinked:
          "Bitte verwenden Sie eine andere Anmeldemethode / Please use a different sign-in method",
        CredentialsSignin:
          "Ungültige E-Mail oder Passwort / Invalid email or password",
        AccessDenied: "Zugriff verweigert / Access denied",
        Configuration:
          "Anmeldung derzeit nicht möglich / Sign-in not available right now",
        Verification: "Link abgelaufen / Link expired",
      };

      setError(
        errorMessages[err.message] ||
          "Etwas ist schiefgelaufen / Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <form
        noValidate
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg border border-gray-200"
      >
        <div className="mb-8 flex justify-center">
          <a href="/" aria-label="Zur Startseite / Back to Home">
            <img
              src="/sis-student-parliament-logo.png"
              alt="SIS Basel Logo"
              className="h-24 w-auto"
            />
          </a>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          Anmelden
        </h1>
        <p className="mb-8 text-center text-lg text-gray-600">Sign In</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              E-Mail / Email
            </label>
            <div className="overflow-hidden rounded-md border border-gray-300 bg-white px-4 py-3 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900">
              <input
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre.email@sisbasel.ch"
                className="w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Passwort / Password
            </label>
            <div className="overflow-hidden rounded-md border border-gray-300 bg-white px-4 py-3 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900">
              <input
                required
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-transparent text-base outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Lädt... / Loading..." : "Anmelden / Sign In"}
          </button>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
            Kein Konto? Bitte wenden Sie sich an das Schulparlament.
            <br />
            Need access? Please contact the school council.
          </div>
        </div>
      </form>
    </div>
  );
}
