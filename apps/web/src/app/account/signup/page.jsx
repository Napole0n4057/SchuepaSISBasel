import { useLanguage } from "@/i18n";

export default function SignUpPage() {
  const { t } = useLanguage();
  return (
    <div className="app-page flex min-h-screen w-full items-center justify-center bg-white p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg border border-gray-200">
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
          {t("Registration is disabled")}
        </h1>
        <p className="mb-8 text-center text-sm text-gray-600">
          {t("Accounts are managed by the school council. Please contact an administrator to get access.")}
        </p>

        <a
          href="/account/signin"
          className="block w-full rounded-md bg-gray-900 px-4 py-3 text-center text-base font-medium text-white hover:bg-gray-800"
        >
          {t("Go to sign in")}
        </a>
      </div>
    </div>
  );
}
