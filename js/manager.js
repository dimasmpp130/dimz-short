import {
  createLink,
  updateLink,
  deleteLink,
  listLinks,
  checkDestination,
  getAnalytics,
  getHealth,
  pauseLink,
  resumeLink,
  recoverWorkspace
} from "./api.js";

import {
  $,
  escapeHtml,
  formatDate,
  getShortUrl,
  selectExpiration,
  validAlias,
  validUrl,
  randomAlias,
  setLoading,
  toast,
  saveLocalLinks,
  getOwnerKey
} from "./utils.js";

import {
  setShareUrl
} from "./share.js";

import {
  setQRUrl
} from "./qr.js";

let editingAlias = null;
let allLinks = [];
const selectedAliases = new Set();

function getFormElements() {

  return {
    form: $("#shortlinkForm"),
    destination: $("#destination"),
    alias: $("#alias"),
    expiration: $("#expiration"),
    customExpiration: $("#customExpiration"),
    customExpirationWrap: $("#customExpirationWrap"),
    password: $("#password"),
    mobileUrl: $("#mobileUrl"),
    desktopUrl: $("#desktopUrl"),
    ab1: $("#ab1"),
    ab2: $("#ab2"),
    countryRules: $("#countryRules"),
    languageRules: $("#languageRules"),
    tags: $("#tags"),
    folder: $("#folder"),
    saveButton: $("#saveBtn"),
    cancelEdit: $("#cancelEdit"),
    formTitle: $("#formTitle")
  };
}

function resetForm() {

  const elements = getFormElements();

  elements.form.reset();

  editingAlias = null;

  elements.formTitle.textContent =
    "Create Shortlink";

  elements.saveButton.dataset.labelMobile = "Create";
  elements.saveButton.innerHTML =
    `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Create Link</span>`;

  elements.cancelEdit.classList.add("hidden");

  elements.customExpirationWrap.classList.add("hidden");
  [elements.mobileUrl, elements.desktopUrl, elements.ab1, elements.ab2, elements.countryRules, elements.languageRules, elements.tags, elements.folder].forEach((el) => { if (el) el.value = ""; });
}

function openResultModal(shortUrl, recoveryCode = "") {

  $("#resultShortUrl").value = shortUrl;

  $("#qrCanvas").innerHTML =
    `<span class="hint">QR akan dibuat saat tombol ditekan.</span>`;

  $("#resultModal").classList.add("show");

  setShareUrl(shortUrl);
  setQRUrl(shortUrl);
  const recovery = $("#recoveryCode");
  if (recovery) { recovery.value = recoveryCode || localStorage.getItem("dimzlink_recovery_code_v1") || ""; }
}

function parseOptionalJson(value, label) {
  if (!value || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${label} harus berupa JSON object yang valid.`);
  }
}

function collectForm() {

  const elements = getFormElements();

  const destination =
    elements.destination.value.trim();

  const alias =
    elements.alias.value.trim();

  if (!validUrl(destination)) {
    throw new Error(
      "Destination harus berupa URL http/https yang valid."
    );
  }

  if (
    alias &&
    !validAlias(alias)
  ) {
    throw new Error(
      "Alias harus 4–32 karakter dan hanya boleh menggunakan A-Z, a-z, 0-9, _ atau -."
    );
  }

  let expiresAt = null;

  if (elements.expiration.value === "custom") {

    if (!elements.customExpiration.value) {
      throw new Error(
        "Pilih tanggal expiration."
      );
    }

    const date =
      new Date(elements.customExpiration.value);

    if (
      Number.isNaN(date.getTime()) ||
      date.getTime() <= Date.now()
    ) {
      throw new Error(
        "Tanggal expiration harus berada di masa depan."
      );
    }

    expiresAt = date.toISOString();

  } else {

    expiresAt =
      selectExpiration(
        elements.expiration.value
      );
  }

  return {
    destination,
    alias: alias || randomAlias(6),
    expiresAt,
    password: elements.password.value,
    mobileUrl: elements.mobileUrl?.value.trim() || null,
    desktopUrl: elements.desktopUrl?.value.trim() || null,
    abDestinations: [elements.ab1?.value.trim(), elements.ab2?.value.trim()].filter(Boolean),
    countryRules: parseOptionalJson(elements.countryRules?.value, "Country rules"),
    languageRules: parseOptionalJson(elements.languageRules?.value, "Language rules"),
    tags: (elements.tags?.value || "").split(",").map(x => x.trim()).filter(Boolean),
    folder: elements.folder?.value.trim() || ""
  };
}

function renderLinks() {

  const container = $("#linksList");
  const search =
    ($("#searchLinks").value || "")
      .trim()
      .toLowerCase();

  const filter = $("#filterLinks")?.value || "all";
  const sort = $("#sortLinks")?.value || "newest";
  let filtered = allLinks.filter((link) => {
    const expired = link.expiresAt && Date.parse(link.expiresAt) <= Date.now();
    if (filter === "active" && (expired || link.paused)) return false;
    if (filter === "paused" && !link.paused) return false;
    if (filter === "expired" && !expired) return false;
    if (filter === "protected" && !link.passwordProtected) return false;
    if (!search) return true;
    const haystack = [link.alias, link.destination, ...(link.tags || []), link.folder || ""].join(" ").toLowerCase();
    return haystack.includes(search);
  });
  filtered.sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (sort === "clicks") return Number(b.clicks || 0) - Number(a.clicks || 0);
    if (sort === "alias") return String(a.alias).localeCompare(String(b.alias));
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  if (!filtered.length) {

    container.innerHTML = `
      <div class="empty">
        <i class="fa-solid fa-link-slash"></i>
        <div>Belum ada shortlink.</div>
      </div>
    `;

    return;
  }

  container.innerHTML =
    filtered.map((link) => {

      const expired =
        link.expiresAt &&
        Date.parse(link.expiresAt) <= Date.now();

      const shortUrl =
        getShortUrl(link.alias);

      return `
        <article class="link-item">
          <label style="padding:8px"><input type="checkbox" data-select="${escapeHtml(link.alias)}" ${selectedAliases.has(link.alias) ? "checked" : ""}></label>

          <div class="link-main">

            <div>
              <div class="link-title">
                ${escapeHtml(shortUrl)}
              </div>

              <div class="link-destination">
                ${escapeHtml(link.destination)}
              </div>

              <div class="link-meta">

                <span class="badge ${expired || link.paused ? "danger" : "success"}">
                  <i class="fa-solid fa-circle"></i>
                  ${expired ? "Expired" : link.paused ? "Paused" : "Active"}
                </span>

                <span class="badge">
                  <i class="fa-solid fa-chart-simple"></i>
                  ${Number(link.clicks || 0)} clicks
                </span>

                <span class="badge">
                  <i class="fa-regular fa-clock"></i>
                  ${formatDate(link.expiresAt)}
                </span>

                ${
                  (link.tags || []).length ? `<span class="badge"><i class="fa-solid fa-tag"></i> ${escapeHtml(link.tags.join(", "))}</span>` : ""
                }

                ${
                  link.passwordProtected
                    ? `
                      <span class="badge">
                        <i class="fa-solid fa-lock"></i>
                        Protected
                      </span>
                    `
                    : ""
                }

              </div>
            </div>

          </div>

          <div class="link-actions">

            <button class="mini-btn" data-action="analytics" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-chart-line"></i> Analytics</button>
            <button class="mini-btn" data-action="health" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-heart-pulse"></i> Health</button>

            <button
              class="mini-btn"
              data-action="toggle"
              data-alias="${escapeHtml(link.alias)}"
            >
              <i class="fa-solid fa-power-off"></i>
              ${link.paused ? "Resume" : "Pause"}
            </button>

            <button
              class="mini-btn"
              data-action="copy"
              data-alias="${escapeHtml(link.alias)}"
            >
              <i class="fa-regular fa-copy"></i>
              Copy
            </button>

            <button
              class="mini-btn"
              data-action="qr"
              data-alias="${escapeHtml(link.alias)}"
            >
              <i class="fa-solid fa-qrcode"></i>
              QR
            </button>

            <button
              class="mini-btn"
              data-action="edit"
              data-alias="${escapeHtml(link.alias)}"
            >
              <i class="fa-solid fa-pen"></i>
              Edit
            </button>

            <button
              class="mini-btn danger"
              data-action="delete"
              data-alias="${escapeHtml(link.alias)}"
            >
              <i class="fa-solid fa-trash"></i>
              Delete
            </button>

          </div>

        </article>
      `;

    }).join("");
}

async function refreshLinks() {

  try {

    const result = await listLinks();

    allLinks =
      Array.isArray(result.links)
        ? result.links
        : [];

    saveLocalLinks(allLinks);

    renderLinks();

  } catch (error) {

    console.error(error);

    renderLinks();

    toast(
      error?.data?.error ||
      "Gagal memuat daftar link."
    );
  }
}

function startEdit(alias) {

  const link =
    allLinks.find(
      (item) => item.alias === alias
    );

  if (!link) {
    return;
  }

  const elements = getFormElements();

  editingAlias = alias;

  elements.destination.value =
    link.destination || "";

  elements.alias.value =
    link.alias || "";

  if (link.expiresAt) {

    const date =
      new Date(link.expiresAt);

    const local =
      new Date(
        date.getTime() -
        date.getTimezoneOffset() * 60000
      )
      .toISOString()
      .slice(0, 16);

    elements.expiration.value =
      "custom";

    elements.customExpiration.value =
      local;

    elements.customExpirationWrap
      .classList.remove("hidden");

  } else {

    elements.expiration.value =
      "never";

    elements.customExpirationWrap
      .classList.add("hidden");
  }

  elements.password.value = "";
  if (elements.mobileUrl) elements.mobileUrl.value = link.mobileUrl || "";
  if (elements.desktopUrl) elements.desktopUrl.value = link.desktopUrl || "";
  if (elements.ab1) elements.ab1.value = link.abDestinations?.[0] || "";
  if (elements.ab2) elements.ab2.value = link.abDestinations?.[1] || "";
  if (elements.countryRules) elements.countryRules.value = Object.keys(link.countryRules || {}).length ? JSON.stringify(link.countryRules) : "";
  if (elements.languageRules) elements.languageRules.value = Object.keys(link.languageRules || {}).length ? JSON.stringify(link.languageRules) : "";
  if (elements.tags) elements.tags.value = (link.tags || []).join(", ");
  if (elements.folder) elements.folder.value = link.folder || "";

  elements.formTitle.textContent =
    `Edit: ${alias}`;

  elements.saveButton.dataset.labelMobile = "Save";
  elements.saveButton.innerHTML =
    `<i class="fa-solid fa-floppy-disk"></i> <span>Save Changes</span>`;

  elements.cancelEdit.classList.remove("hidden");

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}

async function handleSubmit(event) {

  event.preventDefault();

  const elements = getFormElements();

  let payload;

  try {
    payload = collectForm();
  } catch (error) {
    toast(error.message);
    return;
  }

  setLoading(
    elements.saveButton,
    true,
    editingAlias
      ? "Saving..."
      : "Creating..."
  );

  try {

    let result;

    if (editingAlias) {

      result =
        await updateLink(
          editingAlias,
          payload
        );

      toast("Shortlink berhasil diperbarui.");

    } else {
      const destinationCheck = await checkDestination(payload.destination);
      if (destinationCheck.duplicate) {
        const first = destinationCheck.aliases?.[0];
        const keep = window.confirm(`💡 Tujuan ini sudah pernah digunakan${first ? `\nKamu sudah memiliki /${first} yang menuju tujuan yang sama.` : "."}\n\nOK = Buat Tetap\nBatal = Batalkan`);
        if (!keep) { setLoading(elements.saveButton, false); return; }
      }

      payload.ownerKey = getOwnerKey();
      const security = await fetch(`${location.origin}/api/shortlink?action=security`, { cache: "no-store" }).then(r => r.json());
      if (security.challengeRequired && security.recaptchaSiteKey) {
        sessionStorage.setItem("dimzlink_pending_create_v1", JSON.stringify(payload));
        window.location.href = "/verify/mode=create";
        return;
      }

      result = await createLink(payload);
      localStorage.setItem("dimzlink_recovery_code_v1", result.recoveryCode || localStorage.getItem("dimzlink_recovery_code_v1") || "");
      const alias = result.link.alias;
      openResultModal(getShortUrl(alias), result.recoveryCode);
      toast("Shortlink berhasil dibuat.");
    }

    resetForm();
    await refreshLinks();

  } catch (error) {

    console.error(error);

    toast(
      error?.data?.error ||
      error?.message ||
      "Gagal menyimpan shortlink."
    );

  } finally {

    setLoading(
      elements.saveButton,
      false
    );
  }
}

async function handleDelete(alias) {

  const confirmed =
    window.confirm(
      `Hapus shortlink "${alias}"?`
    );

  if (!confirmed) {
    return;
  }

  try {

    await deleteLink(alias);

    toast("Shortlink berhasil dihapus.");

    await refreshLinks();

  } catch (error) {

    toast(
      error?.data?.error ||
      "Gagal menghapus shortlink."
    );
  }
}

async function handleCopy(alias) {

  const shortUrl =
    getShortUrl(alias);

  try {

    await navigator.clipboard.writeText(
      shortUrl
    );

    toast("Link berhasil disalin.");

  } catch {

    toast("Gagal menyalin link.");
  }
}

function openQR(alias) {

  const shortUrl =
    getShortUrl(alias);

  $("#resultShortUrl").value =
    shortUrl;

  $("#qrCanvas").innerHTML =
    `<span class="hint">Tekan Generate QR.</span>`;

  $("#resultModal").classList.add("show");

  setShareUrl(shortUrl);

  import("./qr.js")
    .then(({ setQRUrl }) => {
      setQRUrl(shortUrl);
    });
}

async function handleHealth(alias) {
  try {
    const result = await getHealth(alias);
    const h = result.health || {};
    toast(`${h.status === "green" ? "🟢" : h.status === "yellow" ? "🟡" : "🔴"} Destination: ${h.status}${h.code ? ` (${h.code})` : ""}`);
  } catch (error) { toast(error?.data?.error || "Gagal mengecek destination."); }
}

async function handleToggle(alias) {
  const link = allLinks.find(x => x.alias === alias);
  if (!link) return;
  try {
    await (link.paused ? resumeLink(alias) : pauseLink(alias));
    toast(link.paused ? "Link dilanjutkan." : "Link dijeda.");
    await refreshLinks();
  } catch (error) { toast(error?.data?.error || "Gagal mengubah status link."); }
}

function csvEscape(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

async function handleAnalytics(alias) {
  try {
    const result = await getAnalytics(alias);
    const a = result.analytics || {};
    const modal = document.createElement("div");
    modal.className = "modal show";
    modal.innerHTML = `<div class="modal-card" style="max-width:760px;max-height:85vh;overflow:auto"><div class="modal-head"><h3>Analytics /${escapeHtml(alias)}</h3><button class="close" type="button" data-close><i class="fa-solid fa-xmark"></i></button></div><div class="grid"><div class="badge">Total: ${a.totalClicks || 0}</div><div class="badge">Unique: ${a.uniqueVisitors || 0}</div><div class="badge">Human: ${a.human || 0}</div><div class="badge">Bot: ${a.bot || 0}</div></div><div style="margin-top:16px"><strong>Clicks per day</strong><div>${Object.entries(a.byDay || {}).sort().map(([day,n]) => `<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><span style="width:90px;font-size:12px">${escapeHtml(day)}</span><div style="height:10px;border-radius:6px;background:currentColor;width:${Math.min(100, Math.max(4, Number(n) * 4))}px"></div><span>${n}</span></div>`).join("") || "<span class='hint'>Belum ada data.</span>"}</div></div><pre style="white-space:pre-wrap;font-size:12px;margin-top:16px">${escapeHtml(JSON.stringify({country:a.byCountry,device:a.byDevice,os:a.byOS,browser:a.byBrowser,language:a.byLanguage,referrer:a.byReferrer,recent:a.recent}, null, 2))}</pre><button class="btn btn-secondary" data-export>Export CSV</button></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest("[data-close]")) modal.remove(); if (e.target.closest("[data-export]")) { const rows = [["time","country","device","os","browser","language","referrer","human"], ...(a.recent || []).map(e => [e.time,e.country,e.device,e.os,e.browser,e.language,e.referrer,e.human])]; const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n"); const blob = new Blob([csv], {type:"text/csv;charset=utf-8"}); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href=url; link.download=`dimz-${alias}-analytics.csv`; link.click(); URL.revokeObjectURL(url); }});
  } catch (error) { toast(error?.data?.error || "Gagal memuat analytics."); }
}

async function bulkAction(action) {
  const aliases = [...selectedAliases];
  if (!aliases.length) return toast("Pilih minimal satu link.");
  if (action === "delete" && !confirm(`Hapus ${aliases.length} link terpilih?`)) return;
  try {
    for (const alias of aliases) {
      if (action === "delete") await deleteLink(alias);
      if (action === "pause") await pauseLink(alias);
      if (action === "resume") await resumeLink(alias);
    }
    selectedAliases.clear();
    toast("Bulk action selesai.");
    await refreshLinks();
  } catch (error) { toast(error?.data?.error || "Bulk action gagal."); }
}

function attachEvents() {

  const elements = getFormElements();

  elements.form.addEventListener(
    "submit",
    handleSubmit
  );

  elements.cancelEdit.addEventListener(
    "click",
    resetForm
  );

  elements.expiration.addEventListener(
    "change",
    () => {

      elements.customExpirationWrap
        .classList.toggle(
          "hidden",
          elements.expiration.value !== "custom"
        );

    }
  );

  $("#searchLinks").addEventListener("input", renderLinks);
  $("#filterLinks")?.addEventListener("change", renderLinks);
  $("#sortLinks")?.addEventListener("change", renderLinks);
  $("#bulkPause")?.addEventListener("click", () => bulkAction("pause"));
  $("#bulkResume")?.addEventListener("click", () => bulkAction("resume"));
  $("#bulkDelete")?.addEventListener("click", () => bulkAction("delete"));

  $("#recoverWorkspaceBtn")?.addEventListener("click", async () => {
    const code = $("#recoverWorkspaceCode")?.value.trim();
    if (!code) return toast("Masukkan recovery code.");
    try {
      const result = await recoverWorkspace(code);
      localStorage.setItem("dimzlink_owner_key_v2", result.ownerKey);
      localStorage.setItem("dimzlink_recovery_code_v1", code);
      toast("Workspace berhasil dipulihkan.");
      await refreshLinks();
    } catch (error) {
      toast(error?.data?.error || "Recovery code tidak valid.");
    }
  });

  $("#linksList").addEventListener(
    "click",
    (event) => {

      const selected = event.target.closest("[data-select]");
      if (selected) {
        const selectedAlias = selected.dataset.select;
        if (selected.checked) selectedAliases.add(selectedAlias); else selectedAliases.delete(selectedAlias);
        return;
      }

      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (selected) {
        const alias = selected.dataset.select;
        if (selected.checked) selectedAliases.add(alias); else selectedAliases.delete(alias);
        return;
      }

      const action =
        button.dataset.action;

      const alias =
        button.dataset.alias;

      if (action === "analytics") {
        handleAnalytics(alias);
      }

      if (action === "health") { handleHealth(alias); }

      if (action === "toggle") {
        handleToggle(alias);
      }

      if (action === "copy") {
        handleCopy(alias);
      }

      if (action === "qr") {
        openQR(alias);
      }

      if (action === "edit") {
        startEdit(alias);
      }

      if (action === "delete") {
        handleDelete(alias);
      }
    }
  );

  $("#closeResult").addEventListener(
    "click",
    () => {
      $("#resultModal")
        .classList.remove("show");
    }
  );

  $("#resultModal").addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        $("#resultModal")
      ) {
        $("#resultModal")
          .classList.remove("show");
      }

    }
  );
}

export async function initManager() {
  attachEvents();
  await refreshLinks();
  const createdMatch = location.pathname.match(/^\/created=([A-Za-z0-9_-]{4,32})$/);
  const alias = createdMatch?.[1] || new URLSearchParams(location.search).get("created");
  if (alias) {
    window.history.replaceState({}, document.title, "/shortlink");
    openResultModal(getShortUrl(alias));
    toast("Shortlink berhasil dibuat.");
  }
}
