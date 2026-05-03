export default function SignUpPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white p-4 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg border border-gray-200">
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
          Registrierung deaktiviert
        </h1>
        <p className="mb-6 text-center text-lg text-gray-600">
          Public sign-up is disabled
        </p>
        <p className="mb-8 text-center text-sm text-gray-600">
          Konten werden vom Schulparlament verwaltet. Bitte kontaktieren Sie
          einen Administrator, um Zugriff zu erhalten.
          <br />
          Accounts are managed by the school council. Please contact an admin to
          get access.
        </p>

        <a
          href="/account/signin"
          className="block w-full rounded-md bg-gray-900 px-4 py-3 text-center text-base font-medium text-white hover:bg-gray-800"
        >
          Zur Anmeldung / Go to Sign In
        </a>
      </div>
    </div>
  );
}
