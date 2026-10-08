import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const LANGUAGE_STORAGE_KEY = "schuepas.language";

const messages = {
  "Loading...": { de: "Lädt...", en: "Loading..." },
  "Home": { de: "Startseite", en: "Home" },
  "Back to home": { de: "← Zurück zur Startseite", en: "← Back to home" },
  "Back to forum": { de: "← Zurück zum Forum", en: "← Back to forum" },
  "Sign in": { de: "Anmelden", en: "Sign in" },
  "Go to sign in": { de: "Zur Anmeldung", en: "Go to sign in" },
  "Please sign in": { de: "Bitte melden Sie sich an", en: "Please sign in" },
  "Settings": { de: "Einstellungen", en: "Settings" },
  "Log out": { de: "Abmelden", en: "Log out" },
  "Save": { de: "Speichern", en: "Save" },
  "Cancel": { de: "Abbrechen", en: "Cancel" },
  "Remove": { de: "Entfernen", en: "Remove" },
  "Name": { de: "Name", en: "Name" },
  "Email": { de: "E-Mail", en: "Email" },
  "Email placeholder": { de: "ihre.email@sisbasel.ch", en: "your.email@sisbasel.ch" },
  "SIS Basel logo": { de: "Logo des Schülerparlaments SIS Basel", en: "SIS Basel logo" },
  "Password": { de: "Passwort", en: "Password" },
  "Title": { de: "Titel", en: "Title" },
  "Description": { de: "Beschreibung", en: "Description" },
  "Option {number}": { de: "Option {number}", en: "Option {number}" },
  "Search...": { de: "Suche...", en: "Search..." },
  "Actions": { de: "Aktionen", en: "Actions" },
  "Role": { de: "Rolle", en: "Role" },
  "Admin": { de: "Admin", en: "Admin" },
  "Administrator": { de: "Administrator", en: "Administrator" },
  "Spectator": { de: "Zuschauer", en: "Spectator" },
  "Member": { de: "Mitglied", en: "Member" },
  "Read only": { de: "Nur ansehen", en: "Read only" },
  "Something went wrong": { de: "Etwas ist schiefgelaufen", en: "Something went wrong" },
  "App error detected": { de: "App-Fehler erkannt", en: "App error detected" },
  "An error occurred while using the app.": {
    de: "Bei der Verwendung der App ist ein Fehler aufgetreten.",
    en: "An error occurred while using the app.",
  },
  "Try to fix": { de: "Reparieren versuchen", en: "Try to fix" },
  "Show logs": { de: "Protokolle anzeigen", en: "Show logs" },
  "Copy error": { de: "Fehler kopieren", en: "Copy error" },
  "Could not load data": { de: "Daten konnten nicht geladen werden", en: "Could not load data" },

  "Welcome": { de: "Willkommen", en: "Welcome" },
  "Sign-in access requires a school-approved account": {
    de: "Zugang nur mit freigeschaltetem Schulkonto",
    en: "Sign-in access requires a school-approved account",
  },
  "SIS Basel School Council": { de: "Schülerparlament SIS Basel", en: "SIS Basel School Council" },
  "Welcome, {name}": { de: "Willkommen, {name}", en: "Welcome, {name}" },
  "Votes": { de: "Abstimmungen", en: "Votes" },
  "Vote and view results": { de: "Abstimmen und Ergebnisse sehen", en: "Vote and view results" },
  "Community Forum": { de: "Community-Forum", en: "Community Forum" },
  "Discuss and share": { de: "Diskutieren und teilen", en: "Discuss and share" },
  "Administration": { de: "Verwaltung", en: "Administration" },
  "Manage users and roles": { de: "Benutzer und Rollen verwalten", en: "Manage users and roles" },
  "Official Blog": { de: "Offizieller Blog", en: "Official Blog" },
  "Create post": { de: "Beitrag erstellen", en: "Create post" },
  "No blog posts yet": { de: "Noch keine Blogbeiträge", en: "No blog posts yet" },

  "Error loading posts": { de: "Fehler beim Laden der Beiträge", en: "Error loading posts" },
  "Title and content are required": { de: "Titel und Inhalt sind erforderlich", en: "Title and content are required" },
  "Post created": { de: "Beitrag erstellt", en: "Post created" },
  "Failed to create post": { de: "Beitrag konnte nicht erstellt werden", en: "Failed to create post" },
  "Failed to create comment": { de: "Kommentar konnte nicht erstellt werden", en: "Failed to create comment" },
  "Failed to create vote": { de: "Abstimmung konnte nicht erstellt werden", en: "Failed to create vote" },
  "Failed to vote": { de: "Abstimmung fehlgeschlagen", en: "Failed to vote" },
  "Delete this post?": { de: "Diesen Beitrag löschen?", en: "Delete this post?" },
  "Failed to delete post": { de: "Beitrag konnte nicht gelöscht werden", en: "Failed to delete post" },
  "Post removed": { de: "Beitrag gelöscht", en: "Post removed" },
  "Create a post": { de: "Beitrag erstellen", en: "Create a post" },
  "New post": { de: "Neuer Beitrag", en: "New post" },
  "Title *": { de: "Titel *", en: "Title *" },
  "Content *": { de: "Inhalt *", en: "Content *" },
  "Post anonymously": { de: "Anonym posten", en: "Post anonymously" },
  "No posts yet": { de: "Noch keine Beiträge", en: "No posts yet" },
  "Remove post": { de: "Beitrag entfernen", en: "Remove post" },
  "Comment": { de: "Kommentar", en: "Comment" },
  "Comments: {count}": { de: "Kommentare: {count}", en: "Comments: {count}" },

  "Error loading post": { de: "Fehler beim Laden des Beitrags", en: "Error loading post" },
  "Error loading comments": { de: "Fehler beim Laden der Kommentare", en: "Error loading comments" },
  "Forum post": { de: "Forum-Beitrag", en: "Forum post" },
  "Write a comment": { de: "Kommentar schreiben", en: "Write a comment" },
  "Comment anonymously": { de: "Anonym kommentieren", en: "Comment anonymously" },
  "Post comment": { de: "Kommentar senden", en: "Post comment" },
  "Comment created": { de: "Kommentar erstellt", en: "Comment created" },
  "Delete this comment?": { de: "Diesen Kommentar löschen?", en: "Delete this comment?" },
  "Failed to delete comment": { de: "Kommentar konnte nicht gelöscht werden", en: "Failed to delete comment" },
  "Comment removed": { de: "Kommentar gelöscht", en: "Comment removed" },
  "Remove comment": { de: "Kommentar entfernen", en: "Remove comment" },
  "No comments yet": { de: "Noch keine Kommentare", en: "No comments yet" },

  "Error loading votes": { de: "Fehler beim Laden der Abstimmungen", en: "Error loading votes" },
  "Vote cast": { de: "Stimme abgegeben", en: "Vote cast" },
  "Vote created": { de: "Abstimmung erstellt", en: "Vote created" },
  "Title and at least 2 options are required": {
    de: "Titel und mindestens zwei Optionen sind erforderlich",
    en: "Title and at least 2 options are required",
  },
  "Create vote": { de: "Abstimmung erstellen", en: "Create vote" },
  "New vote": { de: "Neue Abstimmung", en: "New vote" },
  "Options *": { de: "Optionen *", en: "Options *" },
  "Add option": { de: "Option hinzufügen", en: "Add option" },
  "Admin only": { de: "Nur für Admins", en: "Admin only" },
  "Total votes: {count}": { de: "{count} Stimmen insgesamt", en: "Total votes: {count}" },
  "Vote": { de: "Stimme", en: "Vote" },
  "Vote plural": { de: "Stimmen", en: "Votes" },
  "Ended": { de: "Beendet", en: "Ended" },
  "You cannot vote as a spectator": {
    de: "Als Zuschauer können Sie nicht abstimmen",
    en: "You cannot vote as a spectator",
  },
  "No votes available": { de: "Keine Abstimmungen verfügbar", en: "No votes available" },

  "Settings saved": { de: "Einstellungen gespeichert", en: "Settings saved" },
  "The selected image is only a preview and has not been stored permanently.": {
    de: "Das ausgewählte Bild ist nur eine Vorschau und wurde noch nicht dauerhaft gespeichert.",
    en: "The selected image is only a preview and has not been stored permanently.",
  },
  "Could not load settings": { de: "Einstellungen konnten nicht geladen werden", en: "Could not load settings" },
  "Could not save settings": { de: "Einstellungen konnten nicht gespeichert werden", en: "Could not save settings" },
  "Display name": { de: "Anzeigename", en: "Display name" },
  "From your signed-in account": { de: "Aus Ihrem angemeldeten Konto", en: "From your signed-in account" },
  "Profile picture": { de: "Profilbild", en: "Profile picture" },
  "Anonymous": { de: "Anonym", en: "Anonymous" },
  "Profile picture for {name}": { de: "Profilbild von {name}", en: "Profile picture for {name}" },
  "Choose profile picture": { de: "Profilbild auswählen", en: "Choose profile picture" },
  "Change profile picture": { de: "Profilbild ändern", en: "Change profile picture" },
  "Upload profile picture": { de: "Profilbild hochladen", en: "Upload profile picture" },
  "Remove picture": { de: "Profilbild entfernen", en: "Remove picture" },
  "JPG, PNG or WebP, maximum 5 MB. Selected images are only previewed and are not stored permanently yet.": {
    de: "JPG, PNG oder WebP, maximal 5 MB. Ausgewählte Bilder werden derzeit nur als Vorschau angezeigt und noch nicht dauerhaft gespeichert.",
    en: "JPG, PNG or WebP, maximum 5 MB. Selected images are only previewed and are not stored permanently yet.",
  },
  "Choose a JPG, PNG, or WebP image.": {
    de: "Bitte wählen Sie eine JPG-, PNG- oder WebP-Bilddatei aus.",
    en: "Choose a JPG, PNG, or WebP image.",
  },
  "The image must be 5 MB or smaller.": {
    de: "Das Bild darf höchstens 5 MB groß sein.",
    en: "The image must be 5 MB or smaller.",
  },
  "Default anonymity": { de: "Standardmäßig anonym posten", en: "Post anonymously by default" },
  "You can change this for each post": { de: "Sie können dies für jeden Beitrag ändern", en: "You can change this for each post" },
  "Language": { de: "Sprache", en: "Language" },
  "Switch to German": { de: "Zu Deutsch wechseln", en: "Switch to German" },
  "Switch to English": { de: "Zu Englisch wechseln", en: "Switch to English" },

  "Cannot start sign-in": { de: "Anmeldung nicht möglich", en: "Cannot start sign-in" },
  "Sign-in failed": { de: "Anmeldung fehlgeschlagen", en: "Sign-in failed" },
  "Could not create account": { de: "Konto konnte nicht erstellt werden", en: "Could not create account" },
  "This email cannot be used": { de: "Diese E-Mail kann nicht verwendet werden", en: "This email cannot be used" },
  "Please use a different sign-in method": { de: "Bitte verwenden Sie eine andere Anmeldemethode", en: "Please use a different sign-in method" },
  "Invalid email or password": { de: "Ungültige E-Mail oder ungültiges Passwort", en: "Invalid email or password" },
  "Access denied": { de: "Zugriff verweigert", en: "Access denied" },
  "Sign-in is unavailable right now": { de: "Anmeldung derzeit nicht möglich", en: "Sign-in is unavailable right now" },
  "Link expired": { de: "Der Link ist abgelaufen", en: "Link expired" },
  "Security check failed. Please try again": { de: "Sicherheitsprüfung fehlgeschlagen. Bitte versuchen Sie es erneut.", en: "Security check failed. Please try again" },
  "Please fill in all fields": { de: "Bitte füllen Sie alle Felder aus", en: "Please fill in all fields" },
  "No account? Contact the school council for access.": { de: "Kein Konto? Bitte wenden Sie sich für den Zugang an das Schulparlament.", en: "No account? Contact the school council for access." },
  "Registration is disabled": { de: "Die Registrierung ist deaktiviert", en: "Registration is disabled" },
  "Accounts are managed by the school council. Please contact an administrator to get access.": {
    de: "Konten werden vom Schulparlament verwaltet. Bitte kontaktieren Sie einen Administrator, um Zugriff zu erhalten.",
    en: "Accounts are managed by the school council. Please contact an administrator to get access.",
  },

  "Only admins and spectators can access this page": {
    de: "Zugriff verweigert – nur Admins und Zuschauer können diese Seite öffnen",
    en: "Access denied – only admins and spectators can access this page",
  },
  "Error loading user data": { de: "Fehler beim Laden der Benutzerdaten", en: "Error loading user data" },
  "Role updated successfully": { de: "Rolle erfolgreich aktualisiert", en: "Role updated successfully" },
  "Error updating role": { de: "Fehler beim Aktualisieren der Rolle", en: "Error updating role" },
  "New password for {email}": { de: "Neues Passwort für {email}", en: "New password for {email}" },
  "Failed to reset password": { de: "Passwort konnte nicht zurückgesetzt werden", en: "Failed to reset password" },
  "Password reset for {email}": { de: "Passwort für {email} zurückgesetzt", en: "Password reset for {email}" },
  "Error resetting password": { de: "Fehler beim Zurücksetzen des Passworts", en: "Error resetting password" },
  "No valid users found": { de: "Keine gültigen Benutzer gefunden", en: "No valid users found" },
  "Bulk import failed": { de: "Fehler beim Massenimport", en: "Bulk import failed" },
  "Bulk import complete: {created} created, {skipped} skipped, {errors} errors": {
    de: "Massenimport abgeschlossen: {created} erstellt, {skipped} übersprungen, {errors} Fehler",
    en: "Bulk import complete: {created} created, {skipped} skipped, {errors} errors",
  },
  "Could not read file": { de: "Datei konnte nicht gelesen werden", en: "Could not read file" },
  "You can view everything, but only admins can make changes.": {
    de: "Sie können alles ansehen, aber nur Admins können Änderungen vornehmen.",
    en: "You can view everything, but only admins can make changes.",
  },
  "User management": { de: "Benutzerverwaltung", en: "User management" },
  "Reset password": { de: "Passwort zurücksetzen", en: "Reset password" },
  "No users found": { de: "Keine Benutzer gefunden", en: "No users found" },
  "User already exists": { de: "Benutzerkonto besteht bereits", en: "User already exists" },
  "Missing email or password": { de: "E-Mail oder Passwort fehlt", en: "Missing email or password" },
  "User not found": { de: "Benutzer nicht gefunden", en: "User not found" },
  "Only member passwords can be reset": { de: "Nur Passwörter von Mitgliedern können zurückgesetzt werden", en: "Only member passwords can be reset" },
  "Credentials account not found": { de: "Anmeldekonto nicht gefunden", en: "Credentials account not found" },
  "Import accounts": { de: "Konten importieren", en: "Import accounts" },
  "Format A (recommended):": { de: "Format A (empfohlen):", en: "Format A (recommended):" },
  "Format B (legacy):": { de: "Format B (älteres Format):", en: "Format B (legacy):" },
  "Choose .txt file": { de: ".txt-Datei auswählen", en: "Choose .txt file" },
  "Bulk import examples": {
    de: "Max Muster, max@sisbasel.ch, Password123!\nLia Beispiel, lia@sisbasel.ch, Password123!",
    en: "Max Example, max@sisbasel.ch, Password123!\nLia Sample, lia@sisbasel.ch, Password123!",
  },
  "Summary": { de: "Zusammenfassung", en: "Summary" },
  "Total: {count}": { de: "Gesamt: {count}", en: "Total: {count}" },
  "Created: {count}": { de: "Erstellt: {count}", en: "Created: {count}" },
  "Skipped: {count}": { de: "Übersprungen: {count}", en: "Skipped: {count}" },
  "Errors: {count}": { de: "Fehler: {count}", en: "Errors: {count}" },
  "Errors": { de: "Fehler", en: "Errors" },
  "Skipped": { de: "Übersprungen", en: "Skipped" },

  "Create blog post": { de: "Blog-Beitrag erstellen", en: "Create blog post" },
  "Blog post created": { de: "Blog-Beitrag erstellt", en: "Blog post created" },
  "Publish": { de: "Veröffentlichen", en: "Publish" },
  "Access denied - admin only": { de: "Zugriff verweigert – nur für Admins", en: "Access denied – admin only" },

  "Make yourself an admin": { de: "Zum Administrator machen", en: "Make yourself an admin" },
  "Important notice": { de: "Wichtiger Hinweis", en: "Important notice" },
  "This page will make you an admin. Delete this page and route after using it!": {
    de: "Diese Seite macht Sie zum Administrator. Löschen Sie diese Seite und Route nach der Verwendung!",
    en: "This page will make you an admin. Delete this page and route after using it!",
  },
  "Route to delete:": { de: "Zu löschende Route:", en: "Route to delete:" },
  "Signed in as": { de: "Angemeldet als", en: "Signed in as" },
  "Make me admin": { de: "Zum Administrator machen", en: "Make me admin" },
  "Success!": { de: "Erfolg!", en: "Success!" },
  "You are now an admin!": { de: "Sie sind jetzt Administrator!", en: "You are now an admin!" },
  "Go to admin page": { de: "Zur Admin-Seite", en: "Go to admin page" },
  "Don't forget to delete the first-admin route.": {
    de: "Vergessen Sie nicht, die Route zum Erstellen des ersten Admins zu löschen.",
    en: "Don't forget to delete the first-admin route.",
  },

  "Uh-oh! This page doesn't exist yet.": { de: "Oh! Diese Seite gibt es noch nicht.", en: "Uh-oh! This page doesn't exist yet." },
  'Looks like "{path}" is not part of your project. You still have options!': {
    de: 'Die Route "{path}" gehört nicht zu Ihrem Projekt. Sie haben trotzdem Optionen!',
    en: 'Looks like "{path}" is not part of your project. You still have options!',
  },
  "Build it from scratch": { de: "Neu erstellen", en: "Build it from scratch" },
  "Create a new page at this route": { de: "Eine neue Seite für diese Route erstellen", en: "Create a new page at this route" },
  "Create page": { de: "Seite erstellen", en: "Create page" },
  "Check out all project routes here": { de: "Hier finden Sie alle Routen des Projekts", en: "Check out all project routes here" },
  "Pages": { de: "Seiten", en: "Pages" },
};

function readStoredLanguage() {
  if (typeof window === "undefined") return "de";
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "en" ? "en" : "de";
  } catch {
    return "de";
  }
}

const defaultLanguage = readStoredLanguage();
const defaultTranslator = (key, values = {}) => {
  const template = messages[key]?.[defaultLanguage] ?? key;
  return template.replace(/\{([^}]+)\}/g, (_, name) => String(values[name] ?? ""));
};

const LanguageContext = createContext({
  language: defaultLanguage,
  setLanguage: () => {},
  t: defaultTranslator,
});

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // The UI still works for this session if browser storage is unavailable.
    }
  }, [language]);

  const t = useCallback((key, values = {}) => {
    const template = messages[key]?.[language] ?? key;
    return template.replace(/\{([^}]+)\}/g, (_, name) => String(values[name] ?? ""));
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return (
    <LanguageContext.Provider value={value}>
      {children}
      <LanguageSwitch />
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="language-switch" role="group" aria-label={t("Language")}>
      <button
        type="button"
        aria-label={t("Switch to German")}
        aria-pressed={language === "de"}
        onClick={() => setLanguage("de")}
      >
        DE
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        aria-label={t("Switch to English")}
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}

export function messageKeyFromError(message, fallback) {
  const knownMessages = {
    Unauthorized: "Please sign in",
    "Forbidden - Admin access required": "Access denied - admin only",
    "Failed to create comment": "Failed to create comment",
    "Failed to create vote": "Failed to create vote",
    "Failed to create post": "Failed to create post",
    "Failed to delete post": "Failed to delete post",
    "Failed to delete comment": "Failed to delete comment",
    "Failed to cast vote": "Failed to vote",
    "Failed to reset password": "Failed to reset password",
    "User already exists": "User already exists",
    "Missing email or password": "Missing email or password",
    "User not found": "User not found",
    "Only member passwords can be reset": "Only member passwords can be reset",
    "Credentials account not found": "Credentials account not found",
    "Could not read file": "Could not read file",
    "Internal Server Error": "Something went wrong",
    "Unable to save settings": "Could not save settings",
  };
  return knownMessages[message] || (messages[message] ? message : fallback);
}
