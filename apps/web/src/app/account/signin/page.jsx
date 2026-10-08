import { useEffect, useState } from "react";
import { getCsrfToken, signIn } from "@auth/create/react";
import { useLanguage } from "@/i18n";

const errorMessages = {
  OAuthSignin: "Cannot start sign-in",
  OAuthCallback: "Sign-in failed",
  OAuthCreateAccount: "Could not create account",
  EmailCreateAccount: "This email cannot be used",
  Callback: "Something went wrong",
  OAuthAccountNotLinked: "Please use a different sign-in method",
  CredentialsSignin: "Invalid email or password",
  AccessDenied: "Access denied",
  Configuration: "Sign-in is unavailable right now",
  Verification: "Link expired",
  MissingCSRF: "Security check failed. Please try again",
};

function getCallbackUrl() {
  if (typeof window === "undefined") {
    return "/";
  }

  return new URLSearchParams(window.location.search).get("callbackUrl") || "/";
}

export default function SignInPage() {
  const { t } = useLanguage();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode) {
      setError(
        errorMessages[errorCode] || "Something went wrong",
      );
    }

    getCsrfToken()
      .then((token) => {
        if (!cancelled) {
          setCsrfToken(token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCsrfToken("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: true,
        callbackUrl: getCallbackUrl(),
      });
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : undefined;
      setError(
        errorMessages[errorCode] || "Something went wrong",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-page flex min-h-screen w-full items-center justify-center bg-white p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <form
        noValidate
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg border border-gray-200"
      >
        <input type="hidden" name="csrfToken" value={csrfToken} readOnly />
        <div className="mb-8 flex justify-center">
          <a href="/" aria-label={t("Home")}>
            <img
              src="/sis-student-parliament-logo.png"
              alt={t("SIS Basel logo")}
              className="h-24 w-auto"
            />
          </a>
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          {t("Sign in")}
        </h1>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("Email")}
            </label>
            <div className="overflow-hidden rounded-md border border-gray-300 bg-white px-4 py-3 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900">
              <input
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("Email placeholder")}
                className="w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("Password")}
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
              {t(error)}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? t("Loading...") : t("Sign in")}
          </button>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-600">
            {t("No account? Contact the school council for access.")}
          </div>
        </div>
      </form>
    </div>
  );
}
