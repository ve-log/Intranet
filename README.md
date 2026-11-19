# VE-Log – Mitarbeiterportal

Webportal der VE-Log GmbH für Mitarbeiter, Administratoren und Gäste: Zeiterfassung, Urlaub,
Arbeits-/Leistungsnachweise, Lieferscheine, Materialversand, Personal- und Fahrzeugverwaltung,
Einsatzplanung und Baustellen-Nachkalkulation.

Technik: statisches HTML/CSS/JavaScript, Anmeldung und Datenbank über **Firebase**
(Authentication + Realtime Database). Läuft direkt auf **GitHub Pages**.

## Ordnerstruktur

```
index.html                  Anmeldung (Startseite)
404.html                    Fehlerseite für nicht vorhandene Seiten
manifest.json               App-Daten (Startbildschirm-Symbol auf dem Handy)

pages/
├── mitarbeiter/            Dashboard, Zeiterfassung, Urlaub, Kommunikation, Konto, Einstellungen
├── formulare/              Formularübersicht, Arbeitsnachweise, Lieferschein, Material-Formulare, Meine Nachweise
├── personal/               Personalmanagement, Benutzerverwaltung, Schulungen, Dokumente, Genehmigungen …
├── betrieb/                Fahrzeuge, Wartung, Einsatzplanung, Statistiken, Nachkalkulation
├── gast/                   Alle Seiten für Gastbenutzer (gleiche Namen wie bei den Mitarbeitern)
└── auth/                   Registrierung (Mitarbeiter und Gäste)

assets/
├── css/                    Stylesheets (pro Seite oder pro Seitengruppe)
├── js/                     firebase-config.js (zentral!), Nachweis-Skripte, Excel-Nachkalkulation
└── img/                    Logo, Favicon, App-Symbole

data/                       Beispieldaten (kalkulation-beispiel.json)
archive/                    Dateien, die von keiner Seite eingebunden werden (siehe archive/LIESMICH.md)
docs/                       Änderungsprotokoll und offene Punkte
```

## Lokal testen

Die Seiten laden Firebase-Module, deshalb nicht per Doppelklick (`file://`), sondern über einen kleinen Server:

```bash
python3 -m http.server 8000
# danach im Browser: http://localhost:8000
```

## Veröffentlichen (GitHub Pages)

1. Repository auf GitHub hochladen (Inhalt dieses Ordners ins Hauptverzeichnis).
2. *Settings → Pages → Branch: main / Ordner: root* auswählen.
3. In der Firebase-Konsole unter *Authentication → Einstellungen → Autorisierte Domains* die Domain
   `<name>.github.io` eintragen.

## Firebase-Konfiguration

Alles steht zentral in `assets/js/firebase-config.js` und wird dort als `window.VELOG_FIREBASE_CONFIG`
bereitgestellt. Jede Seite bindet diese Datei ein. Ein Projektwechsel erfordert nur **eine** Änderung.

## Neue Seite hinzufügen

1. Passende Seite im gleichen Ordner kopieren (z. B. `pages/formulare/lieferschein.html`).
2. Eigenes CSS nach `assets/css/` legen und per `<link rel="stylesheet" href="../../assets/css/…">` einbinden.
3. Pfade zu Bildern, CSS und JS beginnen in `pages/<ordner>/` immer mit `../../`.
4. Seite in der Navigation der anderen Seiten verlinken.

## Sicherheit

Die Rollenprüfung im Browser ist nur eine Komfortfunktion. Der eigentliche Schutz der Daten
muss in den **Firebase Security Rules** liegen (Details in `SECURITY.md`).
