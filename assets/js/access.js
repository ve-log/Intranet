/*
 * VE-Log – Zugriffsschutz für Verwaltungsbereiche
 *
 * Nur Administratoren und Superadministratoren dürfen sehen:
 * Personalübersicht, Mitarbeiter anlegen, Urlaubsverwaltung, Unternehmensdaten,
 * Benutzerverwaltung, Sicherheit, Systemprotokolle, Backup & Daten, Datenexport.
 *
 * Einbindung (nach firebase-config.js, am besten im <head>):
 *   Link-Ausblendung auf normalen Seiten:
 *     <script src="../../assets/js/access.js"></script>
 *   Zusätzlich die ganze Seite sperren (für Verwaltungsseiten):
 *     <script src="../../assets/js/access.js" data-require="admin"></script>
 *
 * WICHTIG: Das ist nur die Anzeige. Der echte Schutz der Daten sind die
 * Firebase-Realtime-Database-Regeln (roles, users, settings ...).
 * Neue Verwaltungsseiten (z. B. unternehmensdaten.html) immer mit data-require="admin" einbinden.
 */
(function () {
  "use strict";
  var ADMIN_ROLES = ["admin", "superadmin"];
  var RESTRICTED = [
    "personalmanagement", "personaluebersicht", "mitarbeiter-anlegen", "urlaubverwaltung",
    "benutzerverwaltung", "unternehmensdaten", "sicherheit", "protokolle", "backup", "datenexport"
  ];
  var script = document.currentScript;
  var require = script && script.getAttribute("data-require") === "admin";
  var base = script && script.src ? script.src.replace(/assets\/js\/access\.js.*$/, "") : "../../";

  // Sofort ausblenden (vor dem Laden von Firebase), damit nichts aufblitzt.
  var style = document.createElement("style");
  style.id = "access-style";
  style.textContent =
    RESTRICTED.map(function (n) { return 'a[href*="' + n + '.html"]'; }).join(",") +
    "{display:none!important}" + (require ? "html{visibility:hidden}" : "");
  (document.head || document.documentElement).appendChild(style);

  function deny(text) {
    var run = function () {
      document.body.innerHTML =
        '<main style="font-family:Arial,sans-serif;max-width:460px;margin:80px auto;padding:0 20px;text-align:center;color:#263238">' +
        '<h1 style="color:#1d3557">Kein Zugriff</h1><p>' + text + "</p>" +
        '<p><a href="' + base + 'pages/mitarbeiter/dashboard.html" style="color:#922f2b;font-weight:700">Zum Dashboard</a></p></main>';
      style.textContent = "";
    };
    if (document.body) run(); else document.addEventListener("DOMContentLoaded", run);
  }

  function finish(isAdmin, reason) {
    if (isAdmin) { style.remove(); return; }
    if (require) deny(reason || "Dieser Bereich ist nur für Administratoren und Superadministratoren vorgesehen.");
    // Ohne Admin-Rolle bleiben die Links ausgeblendet.
  }

  var config = window.VELOG_FIREBASE_CONFIG;
  if (!config) { finish(false, "Die Berechtigung konnte nicht geprüft werden."); return; }

  var V = "https://www.gstatic.com/firebasejs/12.19.0/";
  Promise.all([
    import(V + "firebase-app.js"),
    import(V + "firebase-auth.js"),
    import(V + "firebase-database.js")
  ]).then(function (m) {
    var app = m[0].getApps().length ? m[0].getApps()[0] : m[0].initializeApp(config);
    var auth = m[1].getAuth(app);
    var db = m[2].getDatabase(app);
    var unsub = m[1].onAuthStateChanged(auth, function (user) {
      if (unsub) unsub();
      if (!user) {
        if (require) location.replace(base + "index.html");
        return;
      }
      m[2].get(m[2].ref(db, "roles/" + user.uid)).then(function (snap) {
        finish(ADMIN_ROLES.indexOf(snap.val()) !== -1);
      }).catch(function () {
        finish(false, "Deine Berechtigung konnte nicht geprüft werden.");
      });
    });
  }).catch(function () {
    finish(false, "Die Berechtigung konnte nicht geprüft werden.");
  });
})();
