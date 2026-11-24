"use strict";
/*
 * VE-Log – E-Mail-Benachrichtigung für Genehmigungen
 *
 * 1) Neuer Antrag (approvals/{id}, Status "open")  -> E-Mail an den zuständigen Manager
 * 2) Entscheidung (open -> approved/rejected)       -> E-Mail an den Antragsteller (mit Begründung)
 * 3) Eingereichter Nachweis/Formular (nachweise/{uid}/{id}, Status "eingereicht")
 *                                                   -> legt automatisch einen Antrag in approvals/ an
 *
 * Zuständig ist: Manager mit gleicher teamId  ->  sonst FALLBACK_APPROVER_EMAILS  ->  sonst alle Admins.
 * Die E-Mail enthält nur einen Link ins Portal. Entschieden wird ausschließlich im Portal (nach Login).
 */
const { onValueCreated, onValueUpdated, onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp({
  databaseURL: "https://ve-log-default-rtdb.europe-west1.firebasedatabase.app",
});

// ---- Konfiguration (wird beim Deploy abgefragt, siehe docs/GENEHMIGUNG-EMAIL-SETUP.md) ----
const SMTP_PASS = defineSecret("SMTP_PASS");
const SMTP_USER = defineString("SMTP_USER", { description: "SMTP-Benutzer, z. B. portal@ve-log.de" });
const SMTP_HOST = defineString("SMTP_HOST", { default: "smtp.office365.com" });
const SMTP_PORT = defineString("SMTP_PORT", { default: "587" });
const MAIL_FROM = defineString("MAIL_FROM", { default: "VE-Log Portal <portal@ve-log.de>" });
const PORTAL_BASE_URL = defineString("PORTAL_BASE_URL", {
  description: "Adresse des Portals ohne Slash am Ende, z. B. https://ve-log.github.io/Intranet",
});
const FALLBACK_APPROVER_EMAILS = defineString("FALLBACK_APPROVER_EMAILS", {
  default: "",
  description: "Optional: Komma-getrennte Adressen, falls kein Team-Manager gefunden wird",
});

const OPTS = { region: "europe-west1", instance: "ve-log-default-rtdb", secrets: [SMTP_PASS] };
const BRAND = "#8e2f2b";
const FORMULAR_NAMEN = {
  arbeitsnachweis: "Arbeitsnachweis",
  arbeitsnachweis_lkw: "Arbeitsnachweis LKW",
  lieferschein: "Lieferschein",
  leistungsnachweis: "Leistungsnachweis",
  materialausgabe: "Materialausgabe",
  material_empfaenger: "Material (Empfänger)",
  material_baustelle: "Material (Baustelle)",
  material_absender: "Material (Absender)",
  fuhrunternehmer: "Fuhrunternehmer",
};

// ---- Hilfsfunktionen ----
const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function niceDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function describe(a) {
  const d = a.details || {};
  const rows = [["Art", a.type || "Antrag"], ["Betreff", a.title || ""]];
  if (d.von) rows.push(["Zeitraum", niceDate(d.von) + (d.bis ? " – " + niceDate(d.bis) : "")]);
  if (d.tage) rows.push(["Arbeitstage", d.tage]);
  if (d.vertretung) rows.push(["Vertretung", d.vertretung]);
  if (d.formular) rows.push(["Formular", d.formular]);
  if (d.datum) rows.push(["Datum", niceDate(d.datum)]);
  if (d.bemerkung) rows.push(["Bemerkung", d.bemerkung]);
  return rows;
}

function layout(title, intro, rows, buttonText, link, footer) {
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#727785;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#232735"><strong>${esc(v)}</strong></td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="de"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e9e9ed">
<tr><td style="background:${BRAND};color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">VE-Log Mitarbeiterportal</td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 10px;color:#232735;font-size:20px">${esc(title)}</h2>
<p style="margin:0 0 18px;color:#232735;font-size:14px;line-height:1.5">${intro}</p>
<table cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:22px">${table}</table>
<a href="${esc(link)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;font-size:14px">${esc(buttonText)}</a>
<p style="margin:22px 0 0;color:#727785;font-size:12px;line-height:1.5">${footer}</p>
</td></tr></table></td></tr></table></body></html>`;
}

function transport() {
  const port = Number(SMTP_PORT.value()) || 587;
  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
  });
}

async function sendMail(to, subject, html) {
  const list = Array.isArray(to) ? to : [to];
  if (!list.length) return;
  await transport().sendMail({ from: MAIL_FROM.value(), to: list.join(", "), subject, html });
}

async function emailOf(uid) {
  try {
    const u = await admin.auth().getUser(uid);
    if (u.email) return u.email;
  } catch (e) { /* weiter */ }
  try {
    return (await admin.database().ref("users/" + uid + "/email").get()).val() || null;
  } catch (e) { return null; }
}

async function findApprovers(approval) {
  const db = admin.database();
  const requester = approval.createdBy;
  const roles = (await db.ref("roles").get()).val() || {};
  const emails = new Set();
  let via = "";

  if (approval.teamId) {
    const snap = await db.ref("users").orderByChild("teamId").equalTo(approval.teamId).get();
    const managers = Object.keys(snap.val() || {}).filter((u) => u !== requester && roles[u] === "manager");
    for (const uid of managers) { const e = await emailOf(uid); if (e) emails.add(e); }
    if (emails.size) via = "team-manager";
  }
  if (!emails.size) {
    FALLBACK_APPROVER_EMAILS.value().split(",").map((s) => s.trim()).filter(Boolean).forEach((e) => emails.add(e));
    if (emails.size) via = "fallback";
  }
  if (!emails.size) {
    const admins = Object.keys(roles).filter((u) => u !== requester && (roles[u] === "admin" || roles[u] === "superadmin"));
    for (const uid of admins) { const e = await emailOf(uid); if (e) emails.add(e); }
    if (emails.size) via = "admins";
  }
  return { emails: [...emails], via };
}

const baseUrl = () => PORTAL_BASE_URL.value().replace(/\/+$/, "");

// ---- 1) Neuer Antrag -> Manager ----
exports.antragNeu = onValueCreated({ ...OPTS, ref: "/approvals/{id}" }, async (event) => {
  const a = event.data.val();
  const id = event.params.id;
  if (!a || a.status !== "open") return;
  const mailRef = event.data.ref.child("mail");
  try {
    const { emails, via } = await findApprovers(a);
    if (!emails.length) {
      logger.warn("Kein Genehmiger gefunden für " + id);
      await mailRef.update({ error: "Kein Genehmiger mit E-Mail-Adresse gefunden", at: admin.database.ServerValue.TIMESTAMP });
      return;
    }
    const html = layout(
      "Neuer Antrag zur Genehmigung",
      `<strong>${esc(a.person || "Ein Mitarbeiter")}</strong> hat einen Antrag eingereicht, der auf deine Entscheidung wartet.`,
      describe(a),
      "Antrag prüfen",
      `${baseUrl()}/pages/personal/genehmigungen.html?id=${encodeURIComponent(id)}`,
      "Bitte melde dich im Portal an und genehmige oder lehne den Antrag dort ab. Bei einer Ablehnung ist eine Begründung erforderlich. Diese E-Mail enthält bewusst keine Entscheidungsfunktion."
    );
    await sendMail(emails, `[VE-Log] Genehmigung erforderlich: ${a.type || "Antrag"} – ${a.person || ""}`.trim(), html);
    await mailRef.update({ managerNotifiedAt: admin.database.ServerValue.TIMESTAMP, recipients: emails.length, via });
  } catch (e) {
    logger.error("Mail an Genehmiger fehlgeschlagen", e);
    await mailRef.update({ error: String(e.message || e).slice(0, 300), at: admin.database.ServerValue.TIMESTAMP });
  }
});

// ---- 2) Entscheidung -> Antragsteller ----
exports.antragEntschieden = onValueUpdated({ ...OPTS, ref: "/approvals/{id}" }, async (event) => {
  const before = event.data.before.val();
  const a = event.data.after.val();
  const id = event.params.id;
  if (!before || !a || before.status === a.status) return;
  if (before.status !== "open" || !["approved", "rejected"].includes(a.status)) return;
  const mailRef = event.data.after.ref.child("mail");
  try {
    const to = await emailOf(a.createdBy);
    if (!to) { await mailRef.update({ error: "Antragsteller ohne E-Mail-Adresse" }); return; }
    const ok = a.status === "approved";
    const dec = a.decision || {};
    const rows = describe(a);
    rows.push(["Entscheidung", ok ? "Genehmigt" : "Abgelehnt"]);
    if (dec.byName) rows.push(["Entschieden von", dec.byName]);
    if (dec.reason) rows.push([ok ? "Anmerkung" : "Begründung", dec.reason]);
    const html = layout(
      ok ? "Dein Antrag wurde genehmigt" : "Dein Antrag wurde abgelehnt",
      ok
        ? "Gute Nachrichten: Dein Antrag wurde genehmigt."
        : "Dein Antrag wurde leider abgelehnt. Die Begründung findest du unten. Bei Rückfragen wende dich bitte an deinen Vorgesetzten.",
      rows,
      "Im Portal ansehen",
      `${baseUrl()}/pages/personal/genehmigungen.html?id=${encodeURIComponent(id)}`,
      "Diese Nachricht wurde automatisch vom VE-Log Mitarbeiterportal gesendet."
    );
    await sendMail(to, `[VE-Log] Dein Antrag wurde ${ok ? "genehmigt" : "abgelehnt"}: ${a.title || a.type || ""}`, html);
    await mailRef.update({ requesterNotifiedAt: admin.database.ServerValue.TIMESTAMP });
  } catch (e) {
    logger.error("Mail an Antragsteller fehlgeschlagen", e);
    await mailRef.update({ error: String(e.message || e).slice(0, 300), at: admin.database.ServerValue.TIMESTAMP });
  }
});

// ---- 3) Eingereichtes Formular (Nachweis) -> Antrag anlegen ----
exports.formularZurGenehmigung = onValueWritten({ ...OPTS, ref: "/nachweise/{uid}/{nid}" }, async (event) => {
  const after = event.data.after.val();
  const before = event.data.before.val();
  if (!after || after.status !== "eingereicht") return;
  if (before && before.status === "eingereicht") return;
  const { uid, nid } = event.params;
  const db = admin.database();
  const ref = db.ref("approvals/approval_" + nid);
  if ((await ref.get()).exists()) return;

  const profile = (await db.ref("users/" + uid).get()).val() || {};
  const email = (await emailOf(uid)) || "";
  const person = [profile.vorname, profile.nachname].filter(Boolean).join(" ").trim() || email || "Mitarbeiter";
  const formular = FORMULAR_NAMEN[after.typ] || "Formular";
  const now = admin.database.ServerValue.TIMESTAMP;
  const record = {
    id: "approval_" + nid,
    type: "Formular",
    title: String(after.titel || formular).slice(0, 100),
    person: person.slice(0, 80),
    priority: "Normal",
    dateLabel: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(new Date()),
    status: "open",
    createdAt: now, createdBy: uid, createdByEmail: email.slice(0, 200),
    updatedAt: now, updatedBy: uid,
    source: "nachweis",
    refPath: `nachweise/${uid}/${nid}`,
    details: { formular, datum: after.datum || "" },
  };
  if (profile.teamId) record.teamId = profile.teamId;
  await ref.set(record); // löst antragNeu aus -> E-Mail an Manager
});
