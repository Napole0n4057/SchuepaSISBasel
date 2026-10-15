# Schüler:innenrat SIS Basel – Website

## 1. Zweck und Geltungsbereich

Diese Website unterstützt die Arbeit des Schüler:innenrats der SIS Basel. Sie bietet insbesondere eine Plattform für Abstimmungen, Mitteilungen und Diskussionen sowie für die Verwaltung der zugehörigen Benutzerkonten.

**Website:** https://schura.social  
**Technische Bereitstellung (Render):** https://schuepasisbasel.onrender.com  
**Quellcode:** https://github.com/Napole0n4057/SchuepaSISBasel

Dieses Dokument richtet sich an die Lehrpersonen und weiteren verantwortlichen Personen, die den Betrieb nach der Übergabe betreuen. Es beschreibt die derzeit bekannte Einrichtung und wichtige Wartungsaufgaben. Es ersetzt weder schulinterne Datenschutzvorgaben noch eine unabhängige Sicherheitsprüfung.

## 2. Funktionen und Zugriffsrechte

Die Website umfasst folgende Bereiche:

- **Anmeldung und Benutzerkonten:** Konten werden durch berechtigte Personen verwaltet; es gibt keine öffentliche Selbstregistrierung.
- **Abstimmungen:** Erstellung, Anzeige und Stimmabgabe über die Website.
- **Forum:** Diskussionen und Kommentare, einschliesslich Antworten auf Kommentare.
- **Blog / Mitteilungen:** Veröffentlichung textbasierter Beiträge.
- **Administration:** Verwaltung von Benutzerkonten, Rollen und Passwörtern; Konten können auch gelöscht werden.
- **Klassenzuordnung:** Zuordnung von Schülerinnen und Schülern zu `Gym` oder `Int` und zu den Jahrgängen 1–6.
- **Mehrsprachige Oberfläche:** Deutsch und Englisch.

Die Anwendung verwendet die Rollen `admin`, `member` und `spectator`:

| Rolle | Vorgesehene Nutzung |
| --- | --- |
| `admin` | Verwaltung von Konten und Rollen sowie administrative Funktionen |
| `member` | Reguläres Schülerkonto; Nutzung der freigegebenen Beteiligungsfunktionen |
| `spectator` | Eingeschränkter Zugang, insbesondere für begleitende Lehrpersonen; Zugriff auf die Klassenzuordnung, jedoch keine allgemeine Kontenadministration |

Die tatsächlich verfügbaren Aktionen hängen zusätzlich von den jeweiligen serverseitigen Berechtigungsprüfungen ab. **Wichtig:** Die Sichtbarkeit und serverseitige Durchsetzung von *klassenspezifischen Abstimmungen* wurde bei der Übergabe nicht abschliessend geprüft. Bis zu einem erfolgreichen Test sollten darüber keine vertraulichen oder verbindlichen Abstimmungen durchgeführt werden.

## 3. Zuständigkeiten bei der Übergabe

Vor der Übergabe sollten mindestens folgende Verantwortlichkeiten ausdrücklich festgelegt werden:

1. **Schulische Verantwortung:** Wer entscheidet über Inhalte, Abstimmungen, Kontoberechtigungen und Löschungen?
2. **Technische Verantwortung:** Wer hat administrativen Zugriff auf GitHub, Render, Neon, Domain/DNS und gegebenenfalls Cloudflare R2?
3. **Stellvertretung:** Wer kann bei Abwesenheit der hauptverantwortlichen Person Zugänge wiederherstellen?
4. **Datenschutz:** Wer bearbeitet Auskunfts-, Berichtigungs- und Löschanfragen gemäss den geltenden Vorgaben?

Zugangsdaten sollten über einen von der Schule freigegebenen Passwortmanager übergeben werden, **nicht** über dieses Repository, eine README-Datei oder unverschlüsselte E-Mails. Prüfen, dass Konten und Dienste nicht ausschliesslich von einem privaten Schülerkonto abhängen.

## 4. Technische Architektur

| Bestandteil | Dienst / Technologie | Aufgabe |
| --- | --- | --- |
| Quellcode und Versionsverwaltung | GitHub / Git | Speichert Änderungen am Projekt |
| Webanwendung | React Router, React, Node.js | Oberfläche und serverseitige Funktionen |
| Bereitstellung | Render | Erstellt und betreibt den Webserver |
| Relationale Datenbank | PostgreSQL auf Neon | Benutzerkonten, Rollen, Abstimmungen, Beiträge und weitere Daten |
| Authentifizierung | Auth.js | Anmeldung und Sitzungen |
| Dateispeicherung | Cloudflare R2 | Speicheranbindung für Profilbilder, soweit verwendet und konfiguriert |
| Domain | `schura.social` | Öffentliche Webadresse; DNS-/Registrarzugang gesondert übergeben |

Das Projekt ist als Repository mit einer Webanwendung unter `apps/web` organisiert. Die nachfolgenden Befehle werden in diesem Unterordner ausgeführt.

## 5. Regelmässige Administration

### Konten verwalten

1. Als Administrator anmelden und den Administrationsbereich öffnen (`/admin`).
2. Neue Konten über die vorgesehenen Verwaltungsfunktionen erstellen oder gesammelt importieren.
3. Für Schülerkonten die richtige Zuordnung zu `Gym`/`Int` und zum Jahrgang prüfen. Bestehende Konten müssen nach Einführung der Klassentabellen gegebenenfalls nachträglich zugeordnet werden.
4. Rollen nur nach schulischer Freigabe ändern. Administratorrechte sparsam vergeben.
5. Passwörter über die vorgesehene Zurücksetzfunktion erneuern; Passwörter nicht in Listen oder Dokumenten sammeln.
6. Vor dem Löschen eines Kontos Identität und Berechtigung prüfen. Die Löschung eines Kontos entfernt nicht zwingend alle bereits veröffentlichten Inhalte oder abgegebenen Stimmen.

Mindestens ein funktionsfähiges Administratorkonto und ein geregelter Wiederherstellungsweg müssen vorhanden sein. Die Anwendung enthält eine Schutzmassnahme gegen das Löschen des letzten Administratorkontos; diese ersetzt keine organisatorische Stellvertretung.

### Klassen und Schuljahreswechsel

Die Klassenzuordnungen werden in der Tabelle `student_classes` gespeichert. Für jährliche Klassenwechsel existiert eine automatische Verarbeitung, deren Durchführung in `student_class_rollovers` protokolliert wird.

- Die Verarbeitung wird beim nächsten geeigneten Anwendungsaufruf nach dem vorgesehenen Stichtag ausgelöst; auf einem schlafenden Server ist sie **nicht zwingend exakt um Mitternacht** abgeschlossen.
- Nach den Sommerferien stichprobenartig kontrollieren, ob die Zuordnungen korrekt fortgeschrieben wurden.
- Abgehende Jahrgänge, insbesondere Jahrgang 6, gesondert überprüfen; Abschluss, Kontolöschung und Archivierung erfordern eine organisatorische Entscheidung.
- Die hinterlegten Ferientermine reichen nach aktuellem Entwicklungsstand nur bis **2032**. Vor dem folgenden Schuljahr müssen die Daten anhand des offiziellen Basler Ferienkalenders überprüft und ergänzt werden.

### Abstimmungen und Inhalte

Vor jeder Abstimmung Zielgruppe, Abstimmungszeitraum und Berechtigung festlegen. Klassenspezifische Beschränkungen zunächst mit mindestens zwei Testkonten aus unterschiedlichen Klassen überprüfen: sowohl Sichtbarkeit als auch tatsächliche Stimmabgabe. Inhalte und Kommentare nach den schulischen Moderations- und Datenschutzregeln betreuen.

## 6. Lokale Entwicklung und Tests

Voraussetzungen: Git, Node.js und npm; Zugriff auf das Repository und eine **separate Testdatenbank**. Die genaue Node-Version muss mit der auf Render eingestellten Version abgeglichen werden.

```bash
# Im geklonten Repository
cd apps/web
npm install --legacy-peer-deps
npm run dev
```

Der lokale Entwicklungsserver wurde bisher unter `http://localhost:4000` verwendet; die tatsächlich angezeigte Adresse im Terminal ist massgeblich.

Verfügbare Prüfungen:

```bash
npm run typecheck
npx vitest run
npm run build
npm audit --omit=dev
```

Zum Zeitpunkt der letzten Übergabeprüfung bestanden **71 Tests in 18 Testdateien**; Typecheck und Produktionsbuild waren erfolgreich. Dies ist keine Garantie für fehlerfreien Betrieb. Insbesondere sind echte Browser- und Berechtigungstests nach Änderungen erforderlich.

**Konfiguration:** Die Anwendung verwendet Umgebungsvariablen, unter anderem `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` und gegebenenfalls weitere dienstspezifische Variablen. Die benötigten Variablennamen müssen vor einem Neuaufbau anhand des Codes und der Render-Konfiguration abgeglichen werden. Werte dürfen nicht in Git eingecheckt werden. Lokale `.env`-Dateien sind vertraulich.

## 7. Änderungen veröffentlichen

Die bisherige Bereitstellung erfolgt über GitHub und Render. Render ist für automatische Deployments aus dem verwendeten Git-Branch konfiguriert (bei der Übergabe: `main`).

Empfohlener Ablauf:

1. Änderungen auf einem separaten Branch entwickeln und mit einer **Testdatenbank** prüfen.
2. Typecheck, Tests und Produktionsbuild ausführen.
3. Falls nötig, Datenbankmigration zuerst auf einem Neon-Testbranch ausprobieren; bestehende Daten und mögliche Löschoperationen prüfen.
4. Vor produktiven Datenbankänderungen eine geeignete Sicherungs- bzw. Wiederherstellungsmöglichkeit kontrollieren.
5. Freigegebene Änderungen nach `main` übernehmen und zu GitHub pushen.
6. In Render kontrollieren, dass der erwartete Commit erfolgreich als **Live** bereitgestellt wurde.
7. Anschliessend Anmeldung, Rollen, Administration, Abstimmungen und Forum im Browser prüfen.

Ein Git-Push allein bestätigt **nicht**, dass der neue Stand erfolgreich und funktionsfähig bereitgestellt wurde.

## 8. Datenbank und Migrationen

Neon verwaltet die PostgreSQL-Datenbank. Für Tests wurde ein separater Branch `testing` verwendet; die produktive Datenbank liegt auf `production`. Vor SQL-Befehlen im Neon SQL Editor **immer den ausgewählten Branch kontrollieren**.

Die Datenbankstruktur und Migrationen befinden sich unter:

- `apps/web/sql/schema.sql`
- `apps/web/sql/migrations/`

Zuletzt angewendete Migrationen vom **15. Oktober 2026**:

| Migration | Zweck |
| --- | --- |
| `20261015_login_rate_limits.sql` | Tabelle für Login-Ratenbegrenzung |
| `20261015_student_classes_and_blog_cleanup.sql` | Tabellen für Klassenzuordnungen und Jahreswechsel; Entfernung einer nicht verwendeten Blog-Bildtabelle, sofern vorhanden |

Diese Migrationen wurden auf `testing` erprobt und anschliessend auf `production` ausgeführt; das Vorhandensein der drei neuen Tabellen wurde kontrolliert. **Bereits angewendete Migrationen nicht wahllos erneut ausführen.** Bei künftigen Änderungen zuerst Abhängigkeiten, Datenbestand und Auswirkungen von `DROP`, `DELETE` und `ALTER` prüfen.

## 9. Sicherheit und Datenschutz

Die Anwendung enthält unter anderem rollenbasierte Berechtigungsprüfungen, eine Prüfung auf noch vorhandene Benutzerkonten bei der Sitzungsvalidierung sowie eine Begrenzung wiederholter fehlgeschlagener Loginversuche.

Wichtige Hinweise:

- `AUTH_SECRET` schützt die Authentifizierungssitzungen. Eine Änderung kann bestehende Sitzungen ungültig machen; anschliessend müssen sich Personen neu anmelden. Der Wert muss in der jeweiligen Umgebung korrekt konfiguriert sein.
- Zugangsdaten, Sitzungstoken und Datenbankverbindungszeichenfolgen niemals in Screenshots, Supportanfragen oder Git veröffentlichen.
- Die IP-bezogene Loginbegrenzung verwendet derzeit die Netzwerkverbindung zum Server. Hinter Render kann dies die Adresse eines gemeinsamen Proxys sein. Dadurch könnten mehrere Nutzer gemeinsam von einer IP-bezogenen Begrenzung betroffen sein. Die tatsächliche Wirkung unter Produktionsbedingungen ist zu beobachten.
- Beim letzten dokumentierten `npm audit --omit=dev` verblieben **8 gemeldete Abhängigkeitsschwachstellen (5 hoch, 3 mittel)**. Diese Meldungen sind vor späteren Aktualisierungen erneut zu prüfen und nach Risiko und Erreichbarkeit zu bewerten. Keine unkontrollierten Paket-Upgrades im Produktivbetrieb durchführen.
- Klassenspezifische Abstimmungsrechte sind **nicht abschliessend verifiziert**.
- Datenaufbewahrung, Auskunft und Löschung sind nach den geltenden schulischen und rechtlichen Anforderungen zu regeln. Eine Kontolöschung ist nicht gleichbedeutend mit einer vollständigen Löschung aller Inhalte.

Vor einer breiteren Einführung empfiehlt sich eine unabhängige technische Sicherheits- und Datenschutzprüfung.

## 10. Fehlersuche und Wiederherstellung

| Problem | Erste Prüfung |
| --- | --- |
| Website nicht erreichbar | Render-Status, Deployment und Logs prüfen |
| Neue Version fehlt | Prüfen, ob der richtige Commit/Branch in Render **Live** ist |
| Anmeldung schlägt fehl | Render-Logs, Auth.js-Konfiguration, `AUTH_SECRET`, Datenbankverbindung und Login-Ratenbegrenzung prüfen |
| Admin-Menü fehlt oder `/admin` verweigert Zugriff | Zuerst Anmeldung und `/api/user-roles/get` prüfen; Rollen in `user_roles` nur lesend kontrollieren, bevor Daten geändert werden |
| `JWTSessionError: no matching decryption secret` | Möglicherweise ungültige Sitzung nach Secret-Wechsel oder unterschiedliche Authentifizierungskonfiguration; neu anmelden und Serverkonfiguration prüfen |
| Neue Datenbankfunktion schlägt fehl | Neon-Branch, vorhandene Tabellen und angewendete Migrationen kontrollieren |
| Automatischer Klassenwechsel fehlt | Stichtage, Aufruf der Anwendung und Einträge in `student_class_rollovers` prüfen |

Bei einem Produktionsfehler zunächst Logs und zuletzt ausgerollten Commit sichern. Ein Rollback des Anwendungscodes stellt **keine** zuvor geänderte Datenbank automatisch wieder her. Datenbank und Code müssen zueinander passen. Keine improvisierten Änderungen an produktiven Rollen oder Benutzerkonten vornehmen.

## 11. Checkliste für die formelle Übergabe

- [ ] Verantwortliche Lehrperson und technische Stellvertretung bestimmt
- [ ] Zugriff auf GitHub, Render, Neon, Domain/DNS und ggf. Cloudflare R2 übergeben
- [ ] Eigentümerschaft und Abrechnung der Dienste geklärt
- [ ] Administratorkonten und Wiederherstellungsverfahren geprüft
- [ ] Umgebungsvariablen und geheime Werte sicher dokumentiert (ausserhalb des Repositorys)
- [ ] Datenbank-Sicherung und Wiederherstellung praktisch überprüft
- [ ] Bestehende Schülerkonten den richtigen Klassen zugeordnet
- [ ] Klassenbeschränkungen bei Abstimmungen mit Testkonten überprüft
- [ ] Datenschutz-, Moderations- und Löschzuständigkeiten festgelegt
- [ ] Verbleibende Abhängigkeitswarnungen und Proxy-/Ratenbegrenzungsrisiken bewertet
- [ ] Schuljahreswechsel und Aktualisierung der Ferientermine organisatorisch eingeplant

## 12. Stand des Dokuments

**Stand: 15. Oktober 2026.** Die Website wurde nach einer Authentifizierungskorrektur erfolgreich neu bereitgestellt; der Zugriff auf den Administrationsbereich wurde anschliessend praktisch bestätigt. Einzelne Funktionen, insbesondere die serverseitige Einschränkung klassenspezifischer Abstimmungen, sind weiterhin gesondert zu verifizieren.

Dieses README sollte bei jeder wesentlichen technischen Änderung, bei Wechseln der verantwortlichen Personen und mindestens einmal pro Schuljahr überprüft werden.
