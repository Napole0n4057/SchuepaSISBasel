import { useState } from "react";
import useAuth from "@/utils/useAuth";

export default function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);

  const { signUpWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Bitte alle Felder ausfüllen / Please fill in all fields");
      setLoading(false);
      return;
    }

    // Check if email is allowed
    setCheckingEmail(true);
    try {
      const checkResponse = await fetch("/api/allowed-emails/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();
      setCheckingEmail(false);

      if (!checkData.allowed) {
        setError(
          "Diese E-Mail ist nicht autorisiert. Bitte kontaktieren Sie einen Administrator. / This email is not authorized. Please contact an administrator.",
        );
        setLoading(false);
        return;
      }

      // Proceed with signup
      await signUpWithCredentials({
        email,
        password,
        callbackUrl: "/account/signin",
        redirect: true,
      });
    } catch (err) {
      setCheckingEmail(false);
      const errorMessages = {
        OAuthSignin: "Registrierung nicht möglich / Could not start sign-up",
        OAuthCallback: "Registrierung fehlgeschlagen / Sign-up failed",
        OAuthCreateAccount:
          "Konto konnte nicht erstellt werden / Could not create account",
        EmailCreateAccount:
          "Diese E-Mail wird bereits verwendet / This email is already in use",
        Callback: "Etwas ist schiefgelaufen / Something went wrong",
        OAuthAccountNotLinked:
          "Bitte verwenden Sie eine andere Registrierungsmethode / Please use a different sign-up method",
        CredentialsSignin:
          "Ungültige E-Mail oder Passwort / Invalid email or password",
        AccessDenied: "Zugriff verweigert / Access denied",
        Configuration:
          "Registrierung derzeit nicht möglich / Sign-up not available right now",
        Verification: "Link abgelaufen / Link expired",
      };

      setError(
        errorMessages[err.message] ||
          "Etwas ist schiefgelaufen / Something went wrong",
      );
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
          Konto erstellen
        </h1>
        <p className="mb-8 text-center text-lg text-gray-600">Create Account</p>

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
            disabled={loading || checkingEmail}
            className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading || checkingEmail
              ? "Lädt... / Loading..."
              : "Registrieren / Sign Up"}
          </button>

          <p className="text-center text-sm text-gray-600">
            Bereits ein Konto? / Already have an account?{" "}
            <a
              href={`/account/signin${
                typeof window !== "undefined" ? window.location.search : ""
              }`}
              className="text-gray-900 hover:text-gray-700 font-medium"
            >
              Anmelden / Sign in
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}
