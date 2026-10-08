import useAuth from "@/utils/useAuth";
import { useLanguage } from "@/i18n";

export default function LogoutPage() {
  const { signOut } = useAuth();
  const { t } = useLanguage();

  const handleSignOut = async () => {
    await signOut({
      callbackUrl: "/account/signin",
      redirect: true,
    });
  };

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
          {t("Log out")}
        </h1>

        <button
          onClick={handleSignOut}
          className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          {t("Log out")}
        </button>
      </div>
    </div>
  );
}
