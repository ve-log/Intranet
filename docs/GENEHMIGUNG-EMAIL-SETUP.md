# Genehmigungen mit E-Mail – Einrichtung

Urlaubsanträge und eingereichte Formulare gehen automatisch per E-Mail an den zuständigen Manager.
Der Manager entscheidet im Portal (Seite **Anträge & Genehmigungen**). Bei einer Ablehnung ist eine
Begründung Pflicht. Der Mitarbeiter bekommt danach eine E-Mail mit dem Ergebnis.

## So funktioniert es

1. **Urlaub:** Mitarbeiter öffnet `urlaubformular.html` → „Zur Genehmigung einreichen“.
   **Formulare:** Wird ein Nachweis/Formular mit Status „eingereicht“ gespeichert, legt die Cloud Function
   automatisch einen Antrag an (kein Umbau der Formulare nötig).
2. Der Antrag liegt in `approvals/{id}` (Status `open`). Die Cloud Function `antragNeu` schickt eine E-Mail
   mit Link an den Manager.
3. Manager klickt auf den Link → Login → Antrag öffnet sich direkt → **Genehmigen** oder **Ablehnen** (Begründung).
4. Die Entscheidung wird gespeichert, in `approvalAudit/` protokolliert und per E-Mail an den Antragsteller gemeldet.

**Wer ist zuständig?** (in dieser Reihenfolge)
1. Benutzer mit Rolle `manager` und **gleicher Team-ID** wie der Antragsteller (Team-ID in der Benutzerverwaltung setzen!)
2. sonst die Adressen aus `FALLBACK_APPROVER_EMAILS`
3. sonst alle Administratoren

Regeln: Niemand entscheidet den eigenen Antrag (außer Superadmin). Manager sehen nur Anträge ihres Teams.
Admins sehen alles und können Entscheidungen zurücknehmen.

## Einrichtung (einmalig)

Voraussetzungen: Firebase CLI (`npm i -g firebase-tools`), `firebase login`, Projekt **ve-log** im **Blaze-Tarif**
(für Cloud Functions nötig; bei kleinem Volumen meist nahezu kostenlos).

```bash
# im Hauptordner des Portals
cd functions && npm install && cd ..

# 1) Datenbankregeln veröffentlichen (enthalten approvals, approvalAudit, Manager-Leserecht für Formulare)
firebase deploy --only database

# 2) E-Mail-Passwort sicher speichern (wird NICHT im Code abgelegt)
firebase functions:secrets:set SMTP_PASS

# 3) Funktionen veröffentlichen – fragt SMTP_USER, PORTAL_BASE_URL usw. ab
firebase deploy --only functions
```

Beim Deploy werden abgefragt:

| Parameter | Beispiel | Bedeutung |
|---|---|---|
| `SMTP_USER` | `portal@ve-log.de` | Postfach, von dem versendet wird |
| `SMTP_HOST` | `smtp.office365.com` | Standard für Microsoft 365 |
| `SMTP_PORT` | `587` | Standard (STARTTLS) |
| `MAIL_FROM` | `VE-Log Portal <portal@ve-log.de>` | Absendername |
| `PORTAL_BASE_URL` | `https://<name>.github.io/<repo>` | Adresse des Portals, **ohne** `/` am Ende |
| `FALLBACK_APPROVER_EMAILS` | `chef@ve-log.de` | optional |

### Microsoft 365 (empfohlen, passend zum Microsoft-Login)
- Ein eigenes Postfach anlegen (z. B. `portal@ve-log.de`, Lizenz oder „Shared Mailbox“ mit Anmelderecht).
- Im Microsoft 365 Admin Center beim Postfach **„Authentifizierter SMTP-Versand“ (SMTP AUTH)** aktivieren.
- Hat das Konto MFA, ein **App-Kennwort** verwenden bzw. SMTP AUTH für dieses Konto erlauben.
- Hinweis: Microsoft schaltet SMTP AUTH mit Basis-Anmeldung in manchen Tenants ab. Dann stattdessen einen
  anderen SMTP-Dienst (z. B. Resend, SendGrid, Brevo) nehmen: nur `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`
  und `SMTP_PASS` ändern, am Code ändert sich nichts.

### Gmail / Google Workspace
`SMTP_HOST=smtp.gmail.com`, Port `587`, mit einem **App-Passwort**.

## Nach dem Deploy prüfen
1. In der Benutzerverwaltung bei Mitarbeiter **und** Manager dieselbe **Team-ID** eintragen.
2. Als Mitarbeiter einen Urlaubsantrag einreichen.
3. Manager erhält die E-Mail, klickt auf den Link, meldet sich an und entscheidet.
4. Fehler bei der Zustellung stehen unter `approvals/{id}/mail/error` (nur für Admins lesbar) und in
   *Firebase-Konsole → Functions → Protokolle*.

## Sicherheit
- Der Mailversand läuft nur serverseitig; Zugangsdaten liegen im Firebase-Secret-Manager, nicht im Repository.
- Die E-Mail enthält nur Basisdaten und einen Link. Entscheidungen sind **nur im Portal nach Login** möglich.
- Alle Rechte (wer lesen, einreichen, entscheiden darf) stehen in `database.rules.json` und werden von Firebase
  erzwungen. Die Anzeige im Browser ist nur Komfort.
- Die Regeln erlauben Managern das Lesen von Formularen **ihres Teams** (nur für die Prüfung vor der Entscheidung).
- Auf GitHub Pages ist alles im Repository öffentlich: keine echten Daten oder Passwörter einchecken.

## Neue Dateien / Änderungen
| Datei | Zweck |
|---|---|
| `functions/index.js`, `functions/package.json` | E-Mail-Versand (Cloud Functions) |
| `firebase.json`, `database.rules.json` | Deploy-Konfiguration und Regeln (Kopie in `docs/firebase-database-rules.json`) |
| `assets/js/approvals.js` | gemeinsame Funktionen für Anträge |
| `pages/personal/genehmigungen.html` | Anträge prüfen/entscheiden (Manager, Admin) bzw. „Meine Anträge“ (Mitarbeiter) |
| `pages/mitarbeiter/urlaubformular.html` | Button „Zur Genehmigung einreichen“ |
| `index.html` | Nach dem Login zurück zum Link aus der E-Mail |
