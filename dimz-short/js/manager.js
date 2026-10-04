import {
  createLink,
  updateLink,
  deleteLink,
  listLinks
} from "./api.js";

import {
  $,
  escapeHtml,
  formatDate,
  getShortUrl,
  parseJSON,
  selectExpiration,
  validAlias,
  validUrl,
  randomAlias,
  setLoading,
  toast,
  saveLocalLinks
} from "./utils.js";

import {
  setShareUrl
} from "./share.js";

import {
  setQRUrl
} from "./qr.js";

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
    mobileUrl: $("#mobileUrl"),
    desktopUrl: $("#desktopUrl"),
    countryRules: $("#countryRules"),
    languageRules: $("#languageRules"),
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

  elements.saveButton.innerHTML =
    `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Create Link</span>`;

  elements.cancelEdit.classList.add("hidden");

  elements.customExpirationWrap.classList.add("hidden");
}

function openResultModal(shortUrl) {

  $("#resultShortUrl").value = shortUrl;

  $("#qrCanvas").innerHTML =
    `<span class="hint">QR akan dibuat saat tombol ditekan.</span>`;

  $("#resultModal").classList.add("show");

  setShareUrl(shortUrl);
  setQRUrl(shortUrl);
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

  const mobileUrl =
    elements.mobileUrl.value.trim();

  const desktopUrl =
    elements.desktopUrl.value.trim();

  if (
    mobileUrl &&
    !validUrl(mobileUrl)
  ) {
    throw new Error(
      "Mobile URL tidak valid."
    );
  }

  if (
    desktopUrl &&
    !validUrl(desktopUrl)
  ) {
    throw new Error(
      "Desktop URL tidak valid."
    );
  }

  const countryRules =
    parseJSON(
      elements.countryRules.value,
      {}
    );

  const languageRules =
    parseJSON(
      elements.languageRules.value,
      {}
    );

  for (const value of Object.values(countryRules)) {

    if (!validUrl(value)) {
      throw new Error(
        "Ada Country URL yang tidak valid."
      );
    }

  }

  for (const value of Object.values(languageRules)) {

    if (!validUrl(value)) {
      throw new Error(
        "Ada Language URL yang tidak valid."
      );
    }

  }

  return {
    destination,
    alias: alias || randomAlias(6),
    expiresAt,
    password: elements.password.value,
    mobileUrl: mobileUrl || null,
    desktopUrl: desktopUrl || null,
    countryRules,
    languageRules
  };
}

function renderLinks() {

  const container = $("#linksList");
  const search =
    ($("#searchLinks").value || "")
      .trim()
      .toLowerCase();

  const filtered =
    allLinks.filter((link) => {

      if (!search) {
        return true;
      }

      return (
        String(link.alias)
          .toLowerCase()
          .includes(search) ||
        String(link.destination)
          .toLowerCase()
          .includes(search)
      );
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

          <div class="link-main">

            <div>
              <div class="link-title">
                ${escapeHtml(shortUrl)}
              </div>

              <div class="link-destination">
                ${escapeHtml(link.destination)}
              </div>

              <div class="link-meta">

                <span class="badge ${expired ? "danger" : "success"}">
                  <i class="fa-solid fa-circle"></i>
                  ${expired ? "Expired" : "Active"}
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

    /*
     * Kalau API belum tersedia / Redis belum siap,
     * tetap jangan bikin halaman kosong total.
     */

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

  elements.mobileUrl.value =
    link.mobileUrl || "";

  elements.desktopUrl.value =
    link.desktopUrl || "";

  elements.countryRules.value =
    link.countryRules
      ? JSON.stringify(
          link.countryRules,
          null,
          2
        )
      : "";

  elements.languageRules.value =
    link.languageRules
      ? JSON.stringify(
          link.languageRules,
          null,
          2
        )
      : "";

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

  elements.formTitle.textContent =
    `Edit: ${alias}`;

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

      result =
        await createLink(payload);

      const alias =
        result.link.alias;

      const shortUrl =
        getShortUrl(alias);

      openResultModal(shortUrl);

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

  $("#searchLinks").addEventListener(
    "input",
    renderLinks
  );

  $("#linksList").addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          "[data-action]"
        );

      if (!button) {
        return;
      }

      const action =
        button.dataset.action;

      const alias =
        button.dataset.alias;

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

export function initManager() {
  attachEvents();
  refreshLinks();
}