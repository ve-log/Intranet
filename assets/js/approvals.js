/*
 * VE-Log – gemeinsame Funktionen für Anträge und Genehmigungen
 * (Urlaub, Formulare). Wird von urlaubformular.html und genehmigungen.html genutzt.
 *
 * Datenbank:  approvals/{id}            der Antrag (Status open | approved | rejected | withdrawn)
 *             approvalAudit/{id}/{evt}  Protokoll jeder Entscheidung
 * E-Mails:    werden von den Cloud Functions in /functions verschickt (nicht vom Browser).
 *
 * WICHTIG: Die Rechte werden in den Firebase-Regeln durchgesetzt (database.rules.json).
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, push, update, query, orderByChild, equalTo, onValue, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

export { ref, get, set, push, update, query, orderByChild, equalTo, onValue, serverTimestamp };

export const STAFF = ["mitarbeiter", "manager", "admin", "superadmin"];
export const DECIDERS = ["manager", "admin", "superadmin"];
export const STATUS_LABEL = { open: "Offen", approved: "Genehmigt", rejected: "Abgelehnt", withdrawn: "Zurückgezogen" };
export const ROLE_LABEL = { mitarbeiter: "Mitarbeiter", manager: "Manager", admin: "Administrator", superadmin: "Superadministrator" };

export function niceDate(value) {
  if (!value) return "";
  const d = new Date(String(value).length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(d);
}
export const niceDateTime = (ts) =>
  ts ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts)) : "";

/** Anzahl Arbeitstage (Mo–Fr) zwischen zwei ISO-Daten, beide inklusive. */
export function workdays(von, bis) {
  const a = new Date(von + "T12:00:00"), b = new Date(bis + "T12:00:00");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  let n = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

/**
 * Meldet den Benutzer an (Weiterleitung zum Login, falls nötig) und liefert den Kontext
 * { db, user, role, name, profile } an onReady. Gäste und unbekannte Rollen -> onDenied(text).
 * Mit redirect:false wird bei fehlender Anmeldung nicht weitergeleitet, sondern onDenied aufgerufen.
 */
export function init({ onReady, onDenied, redirect = true }) {
  const config = window.VELOG_FIREBASE_CONFIG;
  const app = getApps().length ? getApps()[0] : initializeApp(config);
  const auth = getAuth(app);
  const db = getDatabase(app);
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (redirect) {
        // Direktlinks aus E-Mails: nach dem Login zurück zu dieser Seite (siehe index.html)
        try { sessionStorage.setItem("velog:returnTo", location.pathname + location.search); } catch (e) { /* egal */ }
        location.replace(new URL("../../index.html", location.href).href);
      } else onDenied("Bitte zuerst im Portal anmelden.");
      return;
    }
    let role = null;
    try { role = (await get(ref(db, "roles/" + user.uid))).val(); }
    catch (e) { onDenied("Deine Berechtigung konnte nicht geprüft werden."); return; }
    if (!STAFF.includes(role)) { onDenied("Dieser Bereich ist für Mitarbeiter vorgesehen. Gastkonten haben hier keinen Zugriff."); return; }
    let profile = {};
    try { profile = (await get(ref(db, "users/" + user.uid))).val() || {}; } catch (e) { /* Name optional */ }
    const name = [profile.vorname, profile.nachname].filter(Boolean).join(" ").trim() || user.displayName || user.email || "Mitarbeiter";
    onReady({ db, user, role, name, profile });
  });
}

/** Reicht einen Antrag ein. Die E-Mail an den Manager verschickt die Cloud Function. */
export async function submitApproval(ctx, { type, title, details = {}, priority = "Normal" }) {
  const id = push(ref(ctx.db, "approvals")).key;
  const clean = {};
  Object.entries(details).forEach(([k, v]) => { if (v !== "" && v != null) clean[k] = String(v); });
  const item = {
    id, type, title: String(title).slice(0, 100), person: ctx.name.slice(0, 80), priority,
    dateLabel: new Intl.DateTimeFormat("de-DE").format(new Date()),
    status: "open",
    createdAt: serverTimestamp(), createdBy: ctx.user.uid, createdByEmail: (ctx.user.email || "").slice(0, 200),
    updatedAt: serverTimestamp(), updatedBy: ctx.user.uid,
  };
  if (Object.keys(clean).length) item.details = clean;
  if (ctx.profile.teamId) item.teamId = ctx.profile.teamId;
  await set(ref(ctx.db, "approvals/" + id), item);
  return id;
}

/** Manager/Admin entscheidet. Bei Ablehnung ist eine Begründung Pflicht (auch in den Regeln). */
export async function decide(ctx, a, status, reason) {
  reason = (reason || "").trim();
  if (!DECIDERS.includes(ctx.role)) throw new Error("Deine Rolle darf keine Entscheidung treffen.");
  if (status === "rejected" && !reason) throw new Error("Für eine Ablehnung ist eine Begründung erforderlich.");
  const now = serverTimestamp();
  const auditId = push(ref(ctx.db, "approvalAudit/" + a.id)).key;
  const updates = {};
  updates[`approvals/${a.id}/status`] = status;
  updates[`approvals/${a.id}/decision`] = { byUid: ctx.user.uid, byName: ctx.name.slice(0, 120), byRole: ctx.role, at: now, reason: reason.slice(0, 500) };
  updates[`approvals/${a.id}/updatedAt`] = now;
  updates[`approvals/${a.id}/updatedBy`] = ctx.user.uid;
  updates[`approvalAudit/${a.id}/${auditId}`] = {
    requestId: a.id, fromStatus: a.status, toStatus: status, actorUid: ctx.user.uid,
    actorEmail: (ctx.user.email || "").slice(0, 200), actorRole: ctx.role, reason: reason.slice(0, 500), timestamp: now,
  };
  await update(ref(ctx.db), updates);
}

/** Antragsteller zieht einen offenen Antrag zurück. */
export async function withdraw(ctx, a) {
  await update(ref(ctx.db), {
    [`approvals/${a.id}/status`]: "withdrawn",
    [`approvals/${a.id}/updatedAt`]: serverTimestamp(),
    [`approvals/${a.id}/updatedBy`]: ctx.user.uid,
  });
}

/** Darf der Benutzer diesen Antrag entscheiden? (Spiegelt die Firebase-Regeln, nur für die Anzeige.) */
export function canDecide(ctx, a) {
  if (a.status !== "open" || !DECIDERS.includes(ctx.role)) return false;
  if (a.createdBy === ctx.user.uid && ctx.role !== "superadmin") return false;
  if (ctx.role === "manager") return !!a.teamId && a.teamId === ctx.profile.teamId;
  return true;
}

/** Lädt alle für diesen Benutzer sichtbaren Anträge live. Liefert eine Funktion zum Beenden. */
export function watchApprovals(ctx, onData, onError) {
  const parts = {};
  const stops = [];
  const emit = () => {
    const all = {};
    Object.values(parts).forEach((o) => Object.assign(all, o));
    onData(Object.entries(all).map(([id, v]) => ({ ...v, id })).filter((v) => v.title && v.status)
      .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)));
  };
  const listen = (key, q) => stops.push(onValue(q, (s) => { parts[key] = s.val() || {}; emit(); }, onError));
  const col = ref(ctx.db, "approvals");
  if (ctx.role === "admin" || ctx.role === "superadmin") listen("all", col);
  else {
    listen("own", query(col, orderByChild("createdBy"), equalTo(ctx.user.uid)));
    if (ctx.role === "manager" && ctx.profile.teamId) listen("team", query(col, orderByChild("teamId"), equalTo(ctx.profile.teamId)));
  }
  return () => stops.forEach((s) => s());
}
