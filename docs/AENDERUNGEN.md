# Änderungsprotokoll (Aufräumen & Umstrukturierung)

## Erledigt

- **Entfernt:** `kontolöschen` (gespeicherte ChatGPT-Seite, 1 MB), leere Dateien `enutzerverwaltung.html` und
  `firebase-config.js`, `action.html` (nur ein Ordnerbaum als Text, jetzt in der README).
- **Ordnerstruktur:** 62 lose Dateien in `pages/`, `assets/`, `data/`, `archive/`, `docs/` einsortiert.
  Alle Links, Weiterleitungen (`location.href`), Skript- und Bildverweise wurden automatisch angepasst.
- **Umbenannt:** `m.absender` → `material-absender` (ebenso `m.empfaenger`, `m.baustelle`);
  Gast-Seiten verlieren das Präfix `gast…` und liegen in `pages/gast/` (z. B. `gastnachweise` → `gast/nachweise`,
  `gast.html` → `gast/dashboard.html`, `registergast` → `auth/registrieren-gast`).
- **Neu erzeugt:** `pages/gast/material-baustelle.html`. Diese Seite wurde von drei Gast-Seiten verlinkt (`gastm.baustelle.html`), existierte aber nicht.
- **CSS ausgelagert:** Inline-`<style>`-Blöcke liegen jetzt in `assets/css/`. Identische Blöcke (z. B. alle Material-Formulare,
  alle Personal-Listen, Mitarbeiter-/Gast-Paare) teilen sich eine Datei statt je 7× kopiert zu sein.
- **Firebase-Konfiguration zentral:** 44 Kopien der Konfiguration ersetzt durch `assets/js/firebase-config.js`.
- **Neu:** `README.md`, `SECURITY.md`, `404.html`, `manifest.json` (Handy-Startbildschirm), Favicon und App-Symbole, `.gitignore`.
- **Archiviert:** nicht eingebundene Dateien nach `archive/`.
- **Geprüft:** Alle Seiten wurden vor und nach dem Umbau in einem Browser geladen: keine neuen Skriptfehler,
  keine neuen 404-Fehler, Weiterleitungen führen zu den gleichen Zielen.

## Offene Punkte (waren schon im Original so)

Diese Seiten werden verlinkt, existieren aber noch nicht (führen zur 404-Seite):

| Fehlende Seite | Verlinkt von |
|---|---|
| `unternehmensdaten`, `email`, `formulareinstellung`, `backup`, `design`, `protokolle`, `datenexport` | `pages/mitarbeiter/einstellungen.html` |
| `sicherheit` | `pages/mitarbeiter/einstellungen.html`, `benutzerkonto.html` |
| `urlaubverwaltung` | `pages/personal/personalmanagement.html`, `personaluebersicht.html` |
| `arbeitszeiten` | `pages/personal/personaluebersicht.html` |
| `gastpersonalmanagement` | `pages/gast/materialversand.html` |

## Empfohlene nächste Schritte (bewusst noch nicht gemacht)

1. **Firebase Security Rules prüfen** (wichtigster Punkt, siehe `SECURITY.md`).
2. **Gast-Seiten mit Mitarbeiter-Seiten zusammenführen.** Sie unterscheiden sich meist nur in den Links; dafür braucht es eine
   Rollenprüfung pro Seite, die man mit Firebase-Test-Konten durchspielen sollte.
3. **Navigation (Seitenleiste) einmal als Skript** statt in 35 Seiten einzeln pflegen.
4. **Inline-`onclick`-Handler** (296 Stück) schrittweise durch `addEventListener` ersetzen.
5. **Service Worker** für Offline-Betrieb auf der Baustelle (erst nach Test der Firebase-Offline-Funktionen).

## Microsoft-Login und Domain-Sperre (@ve-log.de)
- Registrierung und Login für Mitarbeiter jetzt auch mit Microsoft-Konto (Firebase Auth, Anbieter „Microsoft“).
- Mitarbeiter-Registrierung nur mit @ve-log.de (Browser-Prüfung + Firebase-Rules, siehe `docs/firebase-database-rules.json`).
- `MS_TENANT_ID` in `index.html` und `pages/auth/registrieren.html` mit der Azure-Verzeichnis-ID füllen.
- Azure-Umleitungs-URI: https://ve-log.firebaseapp.com/__/auth/handler

## Zugriffsschutz Verwaltungsbereiche (nur Admin und Superadmin)
- Neu: `assets/js/access.js` blendet Links zu Personalmanagement, Personalübersicht, Mitarbeiter anlegen, Urlaubsverwaltung, Benutzerverwaltung, Unternehmensdaten, Sicherheit, Systemprotokolle, Backup und Datenexport für alle außer Admin/Superadmin aus.
- Mit `data-require="admin"` sperrt das Skript die ganze Seite (eingebunden in Personalübersicht, Mitarbeiter anlegen, Benutzerverwaltung, Personalmanagement).
- Personalübersicht: Mitarbeiter und Manager sehen die Seite nicht mehr (zusätzliche Prüfung in der Seite selbst).
- Einstellungen: Sicherheit, Backup & Daten und Systemprotokolle auch für Admin sichtbar (vorher nur Superadmin).
- Noch nicht vorhandene Seiten (unternehmensdaten, urlaubverwaltung, sicherheit, protokolle, backup, datenexport) beim Erstellen mit `data-require="admin"` einbinden.

## Mitarbeiterbereich: Arbeitszeiten, Krankmeldung, Schulungen
- Neu: `pages/mitarbeiter/krankmeldung.html` (eigene Krankmeldung abgeben, eigene Meldungen sehen) und `pages/mitarbeiter/schulungen.html` (eigene Schulungen und Ablaufdaten, nur lesen).
- Alle Konten außer Gast haben Zugriff (mitarbeiter, manager, admin, superadmin). Gäste sehen nur „Kein Zugriff“.
- Arbeitszeiten = bestehende Zeiterfassung, jetzt in allen Mitarbeiter-Menüs und im Dashboard verlinkt.
- Neue Firebase-Regeln für `hrManagement` (siehe `docs/firebase-database-rules.json`): Mitarbeiter lesen nur eigene Einträge, dürfen nur eigene Krankmeldungen mit Status „Gemeldet“ anlegen. Bearbeiten und Löschen sowie alle Schulungen nur Admin/Superadmin.

## Genehmigungs-Workflow mit E-Mail (Urlaub und Formulare)
- Neu: Cloud Functions in `functions/` (E-Mail an Manager bei neuem Antrag, E-Mail an Mitarbeiter bei Entscheidung, automatische Anträge für eingereichte Formulare).
- Neu: `assets/js/approvals.js`, Seite `pages/personal/genehmigungen.html` komplett neu (echte Datenbank statt Demo, Begründungspflicht bei Ablehnung, Direktlink `?id=`, PDF-Ansicht für Formulare, Protokoll für Admins).
- Neu: `urlaubformular.html` mit Button „Zur Genehmigung einreichen“; `urlaub.html` mit Links „Meine Anträge“ und „Urlaub beantragen“; Dashboard-Kachel „Anträge & Genehmigungen“.
- Neu: Firebase-Regeln für `approvals` und `approvalAudit`; Manager dürfen Formulare ihres Teams lesen (`database.rules.json`, Kopie in `docs/firebase-database-rules.json`).
- `index.html`: Nach dem Login Rücksprung zur ursprünglichen Seite (Links aus E-Mails).
- Einrichtung: siehe `docs/GENEHMIGUNG-EMAIL-SETUP.md`. **Regeln und Functions müssen veröffentlicht werden, sonst funktioniert der Ablauf nicht.**

## Empfänger wählen („Senden an“) bei Formularen und Urlaub
- Neu: `assets/js/einreichen.js` in allen 9 Nachweis-Formularen: Auswahl des Bauleiters, Knopf „Senden“ setzt den Status „eingereicht“ und den Empfänger. (Vorher setzte nichts im Portal diesen Status.)
- Neu: Empfängerliste `approvers/` (Cloud Functions `empfaengerRolle`, `empfaengerProfil`, `rebuildApprovers`), Button „Empfängerliste aktualisieren“ für Admins.
- Der gewählte Empfänger bekommt den Antrag im eigenen Konto und die E-Mail; nur er und Admins können entscheiden.
- Regeln: neu `approvers`, `approvals/assigneeUid`, `nachweise/.../empfaengerUid` (Empfänger darf das eingereichte Formular lesen). Regeln **und** Functions neu veröffentlichen.

## Einheitliche Knöpfe „Speichern / Senden / Drucken“
- Alle Formulare (Mitarbeiter und Gast) haben dieselbe Knopfzeile: **Speichern**, **Senden**, **Drucken**.
- „Senden“ speichert, setzt den Status „eingereicht“ und schickt das Formular an den gewählten Empfänger (`assets/js/einreichen.js`).
- Entfernt: doppelte Knöpfe „Als PDF speichern“ / „PDF“ (taten dasselbe wie Drucken) und der Link „Meine Nachweise / PDF senden“.
