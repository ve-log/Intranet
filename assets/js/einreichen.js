/*
 * VE-Log – „Senden an …“ für alle Nachweis-/Formularseiten
 *
 * Fügt über den Knöpfen „Speichern / Senden / Drucken“ eine Auswahl der Empfänger (z. B. die Bauleiter) ein
 * und verdrahtet den Knopf „Senden“ (<button id="sendNachweis">). Ablauf beim Klick auf „Senden“:
 *   1. Das Formular wird mit der vorhandenen Speichern-Funktion der Seite gespeichert (inkl. PDF).
 *   2. Der Nachweis bekommt Status „eingereicht“ und den gewählten Empfänger (empfaengerUid).
 *   3. Die Cloud Function legt den Antrag im Konto des Empfängers an und schickt ihm eine E-Mail.
 *
 * Einbindung (am Ende der Formularseite):  <script type="module" src="../../assets/js/einreichen.js"></script>
 * Voraussetzung: Seite hat <button id="saveNachweis"> (haben alle Nachweis-Formulare).
 */
import { init, loadFormApprovers, fillApproverSelect, ref, update, serverTimestamp } from "./approvals.js";

const saveButton = document.getElementById("saveNachweis");
if (saveButton) {
  // Meldet, wenn die Seite nach erfolgreichem Speichern die Adresse mit ?id=… setzt (macht jedes Formular so).
  const origReplace = history.replaceState.bind(history);
  history.replaceState = function (state, title, url) {
    const result = origReplace(state, title, url);
    try {
      const id = new URL(url || location.href, location.href).searchParams.get("id");
      if (id) window.dispatchEvent(new CustomEvent("velog:saved", { detail: { id } }));
    } catch (e) { /* egal */ }
    return result;
  };

  const style = document.createElement("style");
  style.textContent = `
  .senden-an{margin:18px 0 10px;padding:14px 16px;border:1px solid #e0d3d2;border-left:4px solid #8e2f2b;border-radius:10px;background:#fbf7f6;font-family:inherit}
  .senden-an h3{margin:0 0 4px;font-size:15px;color:#232735}
  .senden-an p{margin:0 0 10px;font-size:13px;color:#5a6070}
  .senden-an .zeile{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .senden-an select{flex:1 1 220px;min-width:200px;padding:10px 12px;border:1px solid #c9ccd3;border-radius:8px;font:inherit;background:#fff}
  .senden-an button{padding:11px 18px;border:0;border-radius:8px;background:#8e2f2b;color:#fff;font:inherit;font-weight:700;cursor:pointer}
  .senden-an button:disabled{opacity:.5;cursor:not-allowed}
  .senden-an .meldung{margin-top:10px;font-size:13px}
  .senden-an .meldung.ok{color:#356342}.senden-an .meldung.fehler{color:#a43d38}
  @media print{.senden-an{display:none!important}}`;
  document.head.append(style);

  const box = document.createElement("section");
  box.className = "senden-an";
  box.hidden = true;
  box.innerHTML = `<h3>Senden an</h3>
    <p id="sendenHinweis">Wähle die Person, die dieses Formular prüfen soll, und klicke auf „Senden“. Sie bekommt es direkt in ihr Konto und eine E-Mail.</p>
    <div class="zeile"><select id="empfaengerSelect" aria-label="Empfänger"></select></div>
    <div class="meldung" id="sendenMeldung" role="status" aria-live="polite"></div>`;
  (saveButton.parentElement || saveButton).before(box);

  const select = box.querySelector("#empfaengerSelect"), msg = box.querySelector("#sendenMeldung");
  const btn = document.getElementById("sendNachweis");
  const say = (t, c) => { msg.textContent = t; msg.className = "meldung " + (c || ""); };
  let ctx = null, sent = false, denied = "";

  init({
    redirect: false,
    onDenied: (m) => { denied = /Gast/i.test(m) ? "Gastkonten können Formulare nicht senden." : "Bitte zuerst im Portal anmelden, um zu senden."; },
    onReady: async (c) => {
      ctx = c;
      try {
        // Die Genehmiger für diese Vorlage legen Administratoren/Superadministratoren fest.
        const typ = document.body.dataset.nachweisTyp || "";
        const { list, configured } = await loadFormApprovers(c, typ);
        const n = fillApproverSelect(select, list);
        if (!n) say("Für diese Vorlage ist noch kein Genehmiger hinterlegt. Bitte Administrator kontaktieren.", "fehler");
        else if (configured && n === 1) box.querySelector("#sendenHinweis").textContent = "Für dieses Formular ist " + list[0].name + " als Genehmiger hinterlegt.";
        box.hidden = false;
      } catch (e) { box.hidden = false; say("Empfängerliste konnte nicht geladen werden: " + e.message, "fehler"); }
    },
  });

  function waitForSave(ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { window.removeEventListener("velog:saved", on); reject(new Error("Speichern hat nicht geklappt. Bitte Pflichtfelder und die Meldung beim Speichern-Knopf prüfen.")); }, ms);
      function on(e) { clearTimeout(t); window.removeEventListener("velog:saved", on); resolve(e.detail.id); }
      window.addEventListener("velog:saved", on);
    });
  }

  if (btn) btn.addEventListener("click", async () => {
    if (sent) return;
    if (!ctx) { box.hidden = false; select.hidden = true; say(denied || "Senden ist gerade nicht möglich. Bitte kurz warten und erneut versuchen.", "fehler"); return; }
    const empfaengerUid = select.value;
    if (!empfaengerUid) { say("Bitte zuerst einen Empfänger auswählen.", "fehler"); select.focus(); return; }
    const empfaengerName = select.selectedOptions[0].dataset.name || select.selectedOptions[0].textContent;
    if (saveButton.disabled) { say("Speichern ist gerade nicht möglich (keine Verbindung oder nicht angemeldet).", "fehler"); return; }
    if (!confirm("Formular speichern und an " + empfaengerName + " zur Genehmigung senden?\n\nDanach kann es nicht mehr geändert werden.")) return;
    btn.disabled = true; select.disabled = true; say("Formular wird gespeichert …");
    try {
      const saved = waitForSave(90000);
      saveButton.click();
      const id = await saved;
      say("Wird an " + empfaengerName + " gesendet …");
      await update(ref(ctx.db, "nachweise/" + ctx.user.uid + "/" + id), {
        status: "eingereicht", empfaengerUid, empfaengerName: empfaengerName.slice(0, 120),
        einreichtAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      sent = true; saveButton.disabled = true;
      say("✅ Gesendet an " + empfaengerName + ". Er hat das Formular in seinem Konto und eine E-Mail erhalten. Den Status siehst du unter „Anträge & Genehmigungen“.", "ok");
    } catch (e) {
      btn.disabled = false; select.disabled = false;
      say(String(e.message || e).includes("PERMISSION") || /permission/i.test(String(e.message)) ? "Senden abgelehnt. Bitte Anmeldung und Datenbankregeln prüfen." : "Nicht gesendet: " + (e.message || e), "fehler");
    }
  });
}
