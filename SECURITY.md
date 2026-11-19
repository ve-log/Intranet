# Sicherheitshinweise

## Sicherheit melden

Sicherheitslücken bitte **nicht** öffentlich als Issue melden, sondern direkt per E-Mail an die
Projektverantwortlichen (Adresse hier eintragen: `sicherheit@example.com`).
Bitte beschreibe kurz, was du gefunden hast und wie man es nachstellen kann.
Du erhältst in der Regel innerhalb weniger Tage eine Rückmeldung.

## Grundsätze

- **Firebase Security Rules** sind der eigentliche Zugriffsschutz. Rollenprüfungen im Browser
  (`data-admin-only`, Rollen im Frontend) lassen sich umgehen und dienen nur der Anzeige.
  Beispiel: Unter `nachweise/{uid}` darf nur der Benutzer mit dieser `uid` (und Administratoren) lesen und schreiben.
- Der Firebase-`apiKey` im Frontend ist kein Geheimnis. In der Google Cloud Console sollte er
  trotzdem auf die eigene Domain (HTTP-Referrer) eingeschränkt werden.
- GitHub Pages ist rein statisch: **Alles im Repository ist öffentlich lesbar.** Keine echten
  Personal-, Kunden- oder Zugangsdaten einchecken (auch nicht in JSON-Beispieldateien).
- Keine Passwörter, privaten Schlüssel, Service-Account-Dateien oder Exportdateien (z. B. gespeicherte
  Webseiten) ins Repository legen.
- Neue Benutzer erhalten standardmäßig die geringste Rolle; Administratorrechte nur gezielt vergeben.
