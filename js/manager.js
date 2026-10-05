import {
  createLink,
  updateLink,
  listLinks,
  setLinkState
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
  loadLocalLinks
} from "./utils.js";

import { setShareUrl } from "./share.js";
import { setQRUrl } from "./qr.js";

let editingAlias = null;
let allLinks = [];

function getFormElements() {
  return {
    form: $("#shortlinkForm"),
    destination: $("#destination"),
    alias: $("#alias"),
    expiration: $("#expiration"),
    customExpiration: $("#customExpiration"),
    customExpirationWrap: $("#customExpirationWrap"),
    password: $("#password"),
    saveButton: $("#saveBtn"),
    cancelEdit: $("#cancelEdit"),
    formTitle: $("#formTitle")
  };
}

function resetForm() {
  const e = getFormElements();
  e.form.reset();
  editingAlias = null;
  e.formTitle.textContent = "Buat Shortlink";
  e.saveButton.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Buat Link</span>`;
  e.cancelEdit.classList.add("hidden");
  e.customExpirationWrap.classList.add("hidden");
}

function openResultModal(shortUrl, destination = "") {
  $("#resultShortUrl").value = shortUrl;
  $("#resultAnalysis").textContent =
    destination
      ? `Tujuan: ${destination} · Pemeriksaan URL: selesai · Link siap digunakan.`
      : "Pemeriksaan URL: selesai · Link siap digunakan.";
  $("#qrCanvas").innerHTML = `<span class="hint">QR akan dibuat saat tombol ditekan.</span>`;
  $("#resultModal").classList.add("show");
  setShareUrl(shortUrl);
  setQRUrl(shortUrl);
}

function collectForm() {
  const e = getFormElements();
  const destination = e.destination.value.trim();
  const alias = e.alias.value.trim();

  if (!validUrl(destination)) {
    throw new Error("URL tujuan harus berupa alamat http/https yang valid.");
  }
  if (alias && !validAlias(alias)) {
    throw new Error("Alias harus 4–32 karakter dan hanya boleh menggunakan A-Z, a-z, 0-9, _ atau -.");
  }

  let expiresAt = null;
  if (e.expiration.value === "custom") {
    if (!e.customExpiration.value) throw new Error("Pilih tanggal kedaluwarsa.");
    const date = new Date(e.customExpiration.value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error("Tanggal kedaluwarsa harus berada di masa depan.");
    }
    expiresAt = date.toISOString();
  } else {
    expiresAt = selectExpiration(e.expiration.value);
  }

  return {
    destination,
    alias: alias || randomAlias(6),
    expiresAt,
    password: e.password.value
  };
}

function renderLinks() {
  const container = $("#linksList");
  const search = ($("#searchLinks").value || "").trim().toLowerCase();
  const status = $("#linkStatusFilter")?.value || "all";
  const sort = $("#linkSort")?.value || "newest";

  let filtered = allLinks.filter((link) => {
    const text = `${link.alias || ""} ${link.destination || ""}`.toLowerCase();
    if (search && !text.includes(search)) return false;
    const expired = Boolean(link.expiresAt && Date.parse(link.expiresAt) <= Date.now());
    if (status === "expired") return expired;
    if (status === "paused") return !expired && Boolean(link.paused);
    if (status === "active") return !expired && !link.paused;
    if (status === "protected") return Boolean(link.passwordProtected);
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
    if (sort === "clicks") return Number(b.clicks || 0) - Number(a.clicks || 0);
    if (sort === "alias") return String(a.alias || "").localeCompare(String(b.alias || ""));
    return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="empty"><i class="fa-solid fa-link-slash"></i><div>Tidak ada shortlink yang cocok.</div></div>`;
    return;
  }

  container.innerHTML = filtered.map((link) => {
    const expired = link.expiresAt && Date.parse(link.expiresAt) <= Date.now();
    const paused = Boolean(link.paused);
    const shortUrl = getShortUrl(link.alias);
    const healthId = `health-${escapeHtml(link.alias)}`;

    return `
      <article class="link-item">
        <div class="link-main">
          <div>
            <div class="link-title">${escapeHtml(shortUrl)}</div>
            <div class="link-destination">${escapeHtml(link.destination)}</div>
            <div class="link-meta">
              <span class="badge ${expired ? "danger" : paused ? "" : "success"}">
                <i class="fa-solid fa-circle"></i>
                ${expired ? "Kedaluwarsa" : paused ? "Dijeda" : "Aktif"}
              </span>
              <span class="badge"><i class="fa-solid fa-chart-simple"></i> ${Number(link.clicks || 0)} klik</span>
              <span class="badge"><i class="fa-regular fa-clock"></i> ${formatDate(link.expiresAt)}</span>
              ${link.passwordProtected ? `<span class="badge"><i class="fa-solid fa-lock"></i> Berpassword</span>` : ""}
              <span id="${healthId}" class="badge"><i class="fa-solid fa-heart-pulse"></i> Kesehatan: belum dicek</span>
            </div>
          </div>
        </div>
        <div class="link-actions">
          <button class="mini-btn" data-action="copy" data-alias="${escapeHtml(link.alias)}"><i class="fa-regular fa-copy"></i> Salin</button>
          <button class="mini-btn" data-action="health" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-heart-pulse"></i> Health</button>
          <button class="mini-btn" data-action="analytics" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-chart-simple"></i> Analytics</button>
          <button class="mini-btn" data-action="toggle" data-alias="${escapeHtml(link.alias)}">${paused ? '<i class="fa-solid fa-play"></i> Resume' : '<i class="fa-solid fa-pause"></i> Pause'}</button>
          <button class="mini-btn" data-action="qr" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-qrcode"></i> QR</button>
          <button class="mini-btn" data-action="edit" data-alias="${escapeHtml(link.alias)}"><i class="fa-solid fa-pen"></i> Edit</button>
        </div>
      </article>
    `;
  }).join("");
}

async function refreshLinks({ silent = false } = {}) {
  try {
    const result = await listLinks();
    allLinks = Array.isArray(result.links) ? result.links : [];
    saveLocalLinks(allLinks);
    renderLinks();
  } catch (error) {
    console.error(error);
    renderLinks();
    if (!silent) toast(error?.data?.error || "Gagal memuat daftar link.");
  }
}

function startEdit(alias) {
  const link = allLinks.find((item) => item.alias === alias);
  if (!link) return;
  const e = getFormElements();
  editingAlias = alias;
  e.destination.value = link.destination || "";
  e.alias.value = link.alias || "";
  if (link.expiresAt) {
    const date = new Date(link.expiresAt);
    e.expiration.value = "custom";
    e.customExpiration.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    e.customExpirationWrap.classList.remove("hidden");
  } else {
    e.expiration.value = "never";
    e.customExpirationWrap.classList.add("hidden");
  }
  e.password.value = "";
  e.formTitle.textContent = `Edit: ${alias}`;
  e.saveButton.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Simpan Perubahan</span>`;
  e.cancelEdit.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleSubmit(event) {
  event.preventDefault();
  const e = getFormElements();
  let payload;
  try { payload = collectForm(); } catch (error) { toast(error.message); return; }

  setLoading(e.saveButton, true, editingAlias ? "Menyimpan..." : "Membuat...");
  try {
    if (editingAlias) {
      await updateLink(editingAlias, payload);
      toast("Shortlink berhasil diperbarui.");
      resetForm();
      await refreshLinks();
    } else {
      sessionStorage.setItem("dimzlink_pending_create_v1", JSON.stringify(payload));
      window.location.href = "/verify/mode=create";
      return;
    }
  } catch (error) {
    toast(error?.data?.error || error?.message || "Gagal menyimpan shortlink.");
  } finally {
    setLoading(e.saveButton, false);
  }
}

async function handleCopy(alias) {
  try {
    await navigator.clipboard.writeText(getShortUrl(alias));
    toast("Link berhasil disalin.");
  } catch {
    toast("Gagal menyalin link.");
  }
}

async function checkHealth(alias) {
  const link = allLinks.find((item) => item.alias === alias);
  const target = link?.destination;
  const badge = document.getElementById(`health-${alias}`);
  if (!target || !badge) return;

  badge.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa...`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    await fetch(target, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal });
    badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Kesehatan: dapat dijangkau`;
  } catch {
    badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Kesehatan: bermasalah`;
  } finally {
    clearTimeout(timer);
  }
}

function openAnalytics(alias) {
  const link = allLinks.find((item) => item.alias === alias);
  if (!link) return;
  const logs = Array.isArray(link.recentClicks) ? [...link.recentClicks].reverse() : [];
  const unique = new Set(logs.map((x) => x.visitor || x.ipHash).filter(Boolean)).size;
  const human = logs.filter((x) => x.type !== "bot").length;
  const bot = logs.filter((x) => x.type === "bot").length;
  $("#analyticsSummary").textContent = `${Number(link.clicks || 0)} klik · ${unique} pengunjung unik · ${human} manusia · ${bot} bot`;
  $("#analyticsDetails").innerHTML = logs.length ? logs.map((e) => `
    <div class="analytics-item">
      <div><strong>${escapeHtml(e.device || "-")}</strong> · ${escapeHtml(e.os || "-")} · ${escapeHtml(e.browser || "-")}</div>
      <div>${escapeHtml(e.country || "-")} · ${escapeHtml(e.language || "-")}</div>
      <div>${escapeHtml(e.referrer || "Langsung")}</div>
      <small>${escapeHtml(formatDate(e.time))}</small>
    </div>
  `).join("") : `<div class="empty">Belum ada aktivitas.</div>`;
  $("#analyticsModal").classList.add("show");
}

async function toggleLink(alias) {
  const link = allLinks.find((item) => item.alias === alias);
  if (!link) return;
  try {
    await setLinkState(alias, !link.paused);
    toast(link.paused ? "Link dilanjutkan." : "Link dijeda.");
    await refreshLinks();
  } catch (error) {
    toast(error?.data?.error || "Gagal mengubah status link.");
  }
}

function openQR(alias) {
  const shortUrl = getShortUrl(alias);
  $("#resultShortUrl").value = shortUrl;
  $("#resultAnalysis").textContent = "QR siap dibuat dengan logo DIMZ.";
  $("#qrCanvas").innerHTML = `<span class="hint">Tekan Generate QR.</span>`;
  $("#resultModal").classList.add("show");
  setShareUrl(shortUrl);
  setQRUrl(shortUrl);
}

function attachEvents() {
  const e = getFormElements();
  e.form.addEventListener("submit", handleSubmit);
  e.cancelEdit.addEventListener("click", resetForm);
  e.expiration.addEventListener("change", () => {
    e.customExpirationWrap.classList.toggle("hidden", e.expiration.value !== "custom");
  });
  $("#searchLinks").addEventListener("input", renderLinks);
  $("#linkStatusFilter")?.addEventListener("change", renderLinks);
  $("#linkSort")?.addEventListener("change", renderLinks);

  $("#linksList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const alias = button.dataset.alias;
    if (action === "copy") handleCopy(alias);
    if (action === "health") checkHealth(alias);
    if (action === "analytics") openAnalytics(alias);
    if (action === "toggle") toggleLink(alias);
    if (action === "qr") openQR(alias);
    if (action === "edit") startEdit(alias);
  });

  $("#closeResult").addEventListener("click", () => $("#resultModal").classList.remove("show"));
  $("#closeAnalytics").addEventListener("click", () => $("#analyticsModal").classList.remove("show"));
  $("#analyticsModal").addEventListener("click", (event) => {
    if (event.target === $("#analyticsModal")) $("#analyticsModal").classList.remove("show");
  });
  $("#resultModal").addEventListener("click", (event) => {
    if (event.target === $("#resultModal")) $("#resultModal").classList.remove("show");
  });
}

export async function initManager() {
  attachEvents();
  allLinks = loadLocalLinks();
  renderLinks();
  refreshLinks({ silent: true });
  const createdMatch = location.pathname.match(/^\/created=([A-Za-z0-9_-]{4,32})$/);
  const alias = createdMatch?.[1] || new URLSearchParams(location.search).get("created");
  if (alias) {
    window.history.replaceState({}, document.title, "/shortlink");
    openResultModal(getShortUrl(alias));
    toast("Shortlink berhasil dibuat.");
  }
}
