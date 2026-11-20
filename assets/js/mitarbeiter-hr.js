/*
 * Gemeinsame Basis der Mitarbeiter-Seiten Krankmeldung und Schulungen.
 * Zugriff: alle angemeldeten Konten mit Rolle mitarbeiter, manager, admin, superadmin. Gäste nicht.
 */
import {initializeApp, getApps} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {getAuth, onAuthStateChanged} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {getDatabase, ref, get, set, push, query, orderByChild, equalTo, onValue} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export {ref, set, push, query, orderByChild, equalTo, onValue};
const STAFF = ["mitarbeiter", "manager", "admin", "superadmin"];
const $ = id => document.getElementById(id);

export function niceDate(value) {
  if (!value) return "—";
  const d = new Date(String(value).length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("de-DE", {dateStyle: "medium"}).format(d);
}

function deny(text) {
  $("app").hidden = true;
  $("gate").hidden = false;
  $("gate").innerHTML = "<h1>Kein Zugriff</h1><p></p><p><a href=\"dashboard.html\">Zum Dashboard</a></p>";
  $("gate").querySelector("p").textContent = text;
}

export function start(ready) {
  const config = window.VELOG_FIREBASE_CONFIG;
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  onAuthStateChanged(auth, async user => {
    if (!user) { location.replace("../../index.html"); return; }
    let role = null;
    try {
      role = (await get(ref(db, "roles/" + user.uid))).val();
    } catch (e) {
      deny("Deine Berechtigung konnte nicht geprüft werden."); return;
    }
    if (!STAFF.includes(role)) {
      deny("Dieser Bereich ist für Mitarbeiter vorgesehen. Gastkonten haben hier keinen Zugriff."); return;
    }
    let profile = {};
    try { profile = (await get(ref(db, "users/" + user.uid))).val() || {}; } catch (e) { /* Name optional */ }
    const name = [profile.vorname, profile.nachname].filter(Boolean).join(" ").trim() || user.displayName || user.email || "Mitarbeiter";
    $("who").textContent = name;
    $("gate").hidden = true;
    $("app").hidden = false;
    ready({db, user, role, name, profile});
  });
}
