"use strict";

const API_URL =
  "/api/admins";

let allLinks = [];

let selectedEditAlias =
  null;

const loginPage =
  document.getElementById(
    "loginPage"
  );

const adminApp =
  document.getElementById(
    "adminApp"
  );

const loginForm =
  document.getElementById(
    "loginForm"
  );

const loginButton =
  document.getElementById(
    "loginButton"
  );

const adminPassword =
  document.getElementById(
    "adminPassword"
  );

const loginError =
  document.getElementById(
    "loginError"
  );

const linksBody =
  document.getElementById(
    "linksBody"
  );

const searchInput =
  document.getElementById(
    "searchInput"
  );

const refreshButton =
  document.getElementById(
    "refreshButton"
  );

const logoutButton =
  document.getElementById(
    "logoutButton"
  );

const editModal =
  document.getElementById(
    "editModal"
  );

const clickModal =
  document.getElementById(
    "clickModal"
  );

const editForm =
  document.getElementById(
    "editForm"
  );

const editAlias =
  document.getElementById(
    "editAlias"
  );

const editAliasDisplay =
  document.getElementById(
    "editAliasDisplay"
  );

const editDestination =
  document.getElementById(
    "editDestination"
  );

const editMobileUrl =
  document.getElementById(
    "editMobileUrl"
  );

const editDesktopUrl =
  document.getElementById(
    "editDesktopUrl"
  );

const editExpiresAt =
  document.getElementById(
    "editExpiresAt"
  );

const clickDetails =
  document.getElementById(
    "clickDetails"
  );

const toast =
  document.getElementById(
    "toast"
  );

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function formatNumber(value) {

  return new Intl.NumberFormat(
    "id-ID"
  ).format(
    Number(value || 0)
  );
}

function formatDate(value) {

  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";
  }

  return date.toLocaleString(
    "id-ID",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function showToast(message) {

  toast.textContent =
    message;

  toast.classList.add(
    "show"
  );

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(
      () => {

        toast.classList.remove(
          "show"
        );

      },
      2500
    );
}

function showLoginError(message) {

  loginError.textContent =
    message;

  loginError.classList.remove(
    "hidden"
  );
}

function clearLoginError() {

  loginError.textContent =
    "";

  loginError.classList.add(
    "hidden"
  );
}

async function api(
  url = API_URL,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        credentials: "same-origin",

        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {})
        }
      }
    );

  let data = null;

  try {

    data =
      await response.json();

  } catch {

    data = {};
  }

  if (!response.ok) {

    const error =
      new Error(
        data.error ||
        `Request gagal (${response.status})`
      );

    error.status =
      response.status;

    throw error;
  }

  return data;
}

async function checkSession() {

  try {

    const data =
      await api();

    if (
      data.ok &&
      data.authenticated
    ) {

      showAdmin();

      await loadDashboard();

      return;
    }

  } catch {

  }

  showLogin();
}

loginForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    clearLoginError();

    const password =
      adminPassword.value;

    if (!password) {

      showLoginError(
        "Password wajib diisi."
      );

      return;
    }

    loginButton.disabled =
      true;

    loginButton.textContent =
      "Login...";

    try {

      const data =
        await api(
          API_URL,
          {
            method: "POST",

            body:
              JSON.stringify({
                action: "login",
                password
              })
          }
        );

      if (!data.ok) {

        throw new Error(
          data.error ||
          "Login gagal."
        );
      }

      adminPassword.value =
        "";

      showAdmin();

      await loadDashboard();

    } catch (error) {

      showLoginError(
        error.message ||
        "Login gagal."
      );

    } finally {

      loginButton.disabled =
        false;

      loginButton.textContent =
        "Login Admin";
    }

  }
);

function showLogin() {

  loginPage.classList.remove(
    "hidden"
  );

  adminApp.classList.add(
    "hidden"
  );

  adminPassword.focus();
}

function showAdmin() {

  loginPage.classList.add(
    "hidden"
  );

  adminApp.classList.remove(
    "hidden"
  );
}

async function loadDashboard() {

  refreshButton.disabled =
    true;

  refreshButton.textContent =
    "Loading...";

  try {

    const data =
      await api();

    if (
      !data.authenticated
    ) {

      showLogin();
      return;
    }

    allLinks =
      Array.isArray(
        data.links
      )
        ? data.links
        : [];

    renderStats(
      data.stats || {}
    );

    renderTable(
      allLinks
    );

  } catch (error) {

    if (
      error.status === 401
    ) {

      showLogin();

      return;
    }

    showToast(
      error.message ||
      "Gagal memuat dashboard."
    );

  } finally {

    refreshButton.disabled =
      false;

    refreshButton.textContent =
      "Refresh";
  }
}

function renderStats(
  stats
) {

  document.getElementById(
    "totalLinks"
  ).textContent =
    formatNumber(
      stats.totalLinks
    );

  document.getElementById(
    "totalClicks"
  ).textContent =
    formatNumber(
      stats.totalClicks
    );

  document.getElementById(
    "mobileClicks"
  ).textContent =
    formatNumber(
      stats.devices?.mobile || 0
    );

  document.getElementById(
    "desktopClicks"
  ).textContent =
    formatNumber(
      stats.devices?.desktop || 0
    );
}

function renderTable(
  links
) {

  const query =
    searchInput.value
      .trim()
      .toLowerCase();

  const filtered =
    links.filter(
      (link) => {

        if (!query) {
          return true;
        }

        const searchable =
          [
            link.alias,
            link.destination,
            link.country,
            link.browser
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(
          query
        );
      }
    );

  if (!filtered.length) {

    linksBody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty">
            Tidak ada shortlink ditemukan.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  linksBody.innerHTML =
    filtered
      .map(
        (link) =>
          createRow(link)
      )
      .join("");
}

function createRow(
  link
) {

  const devices =
    summarizeField(
      link.recentClicks,
      "device"
    );

  const browsers =
    summarizeField(
      link.recentClicks,
      "browser"
    );

  const countries =
    summarizeField(
      link.recentClicks,
      "country"
    );

  return `
    <tr>

      <td>
        <div class="alias">
          ${escapeHtml(link.alias)}
        </div>
      </td>

      <td>
        <div
          class="destination"
          title="${escapeHtml(link.destination)}"
        >
          ${escapeHtml(link.destination)}
        </div>
      </td>

      <td>
        <span class="clicks">
          ${formatNumber(link.clicks)}
        </span>
      </td>

      <td>
        ${renderSummaryPills(devices)}
      </td>

      <td>
        ${renderSummaryPills(browsers)}
      </td>

      <td>
        ${renderSummaryPills(countries)}
      </td>

      <td>
        <span class="pill">
          ${escapeHtml(
            formatDate(
              link.createdAt
            )
          )}
        </span>
      </td>

      <td>

        <div class="actions">

          <button
            class="small-btn"
            type="button"
            data-action="clicks"
            data-alias="${escapeHtml(link.alias)}"
          >
            Stats
          </button>

          <button
            class="small-btn"
            type="button"
            data-action="edit"
            data-alias="${escapeHtml(link.alias)}"
          >
            Edit
          </button>

          <button
            class="small-btn delete"
            type="button"
            data-action="delete"
            data-alias="${escapeHtml(link.alias)}"
          >
            Delete
          </button>

        </div>

      </td>

    </tr>
  `;
}

function summarizeField(
  logs,
  field
) {

  const result = {};

  if (
    !Array.isArray(logs)
  ) {

    return result;
  }

  for (
    const item of logs
  ) {

    const value =
      item?.[field] ||
      "Unknown";

    result[value] =
      (result[value] || 0) + 1;
  }

  return result;
}

function renderSummaryPills(
  summary
) {

  const entries =
    Object.entries(
      summary
    )
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .slice(0, 3);

  if (!entries.length) {

    return `
      <span class="pill">
        -
      </span>
    `;
  }

  return entries
    .map(
      ([key, value]) =>
        `
          <span
            class="pill"
            title="${escapeHtml(key)}"
          >
            ${escapeHtml(key)}
            ${value}
          </span>
        `
    )
    .join(" ");
}

searchInput.addEventListener(
  "input",
  () => {

    renderTable(
      allLinks
    );

  }
);

linksBody.addEventListener(
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

    const link =
      allLinks.find(
        (item) =>
          item.alias === alias
      );

    if (!link) {
      return;
    }

    if (
      action === "edit"
    ) {

      openEdit(link);

      return;
    }

    if (
      action === "delete"
    ) {

      deleteLink(link);

      return;
    }

    if (
      action === "clicks"
    ) {

      openClickDetails(link);

      return;
    }

  }
);

function openEdit(link) {

  selectedEditAlias =
    link.alias;

  editAlias.value =
    link.alias;

  editAliasDisplay.value =
    link.alias;

  editDestination.value =
    link.destination || "";

  editMobileUrl.value =
    link.mobileUrl || "";

  editDesktopUrl.value =
    link.desktopUrl || "";

  editExpiresAt.value =
    toDatetimeLocal(
      link.expiresAt
    );

  editModal.classList.remove(
    "hidden"
  );
}

function closeEditModal() {

  editModal.classList.add(
    "hidden"
  );

  selectedEditAlias =
    null;
}

function toDatetimeLocal(
  value
) {

  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";
  }

  const pad =
    (number) =>
      String(number)
        .padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

editForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (!selectedEditAlias) {
      return;
    }

    const destination =
      editDestination.value.trim();

    if (!destination) {

      showToast(
        "Destination wajib diisi."
      );

      return;
    }

    const payload = {

      action: "update",

      alias:
        selectedEditAlias,

      destination,

      mobileUrl:
        editMobileUrl.value.trim() ||
        null,

      desktopUrl:
        editDesktopUrl.value.trim() ||
        null,

      expiresAt:
        editExpiresAt.value
          ? new Date(
              editExpiresAt.value
            ).toISOString()
          : null
    };

    try {

      const data =
        await api(
          API_URL,
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              )
          }
        );

      if (!data.ok) {

        throw new Error(
          data.error ||
          "Gagal menyimpan."
        );
      }

      closeEditModal();

      showToast(
        "Shortlink berhasil diperbarui."
      );

      await loadDashboard();

    } catch (error) {

      showToast(
        error.message ||
        "Gagal memperbarui shortlink."
      );
    }

  }
);

async function deleteLink(
  link
) {

  const confirmed =
    window.confirm(
      `Hapus shortlink "${link.alias}"?\n\nTindakan ini juga akan menghapus data kliknya.`
    );

  if (!confirmed) {
    return;
  }

  try {

    const data =
      await api(
        API_URL,
        {
          method: "POST",

          body:
            JSON.stringify({
              action: "delete",
              alias: link.alias
            })
        }
      );

    if (!data.ok) {

      throw new Error(
        data.error ||
        "Gagal menghapus."
      );
    }

    showToast(
      "Shortlink berhasil dihapus."
    );

    await loadDashboard();

  } catch (error) {

    showToast(
      error.message ||
      "Gagal menghapus shortlink."
    );
  }
}

function openClickDetails(
  link
) {

  const logs =
    Array.isArray(
      link.recentClicks
    )
      ? [
          ...link.recentClicks
        ].reverse()
      : [];

  if (!logs.length) {

    clickDetails.innerHTML = `
      <div class="empty">
        Belum ada data klik.
      </div>
    `;

  } else {

    clickDetails.innerHTML =
      logs
        .map(
          (item) =>
            `
              <div class="click-item">

                <div class="click-main">

                  <span class="pill">
                    ${escapeHtml(
                      item.device ||
                      "Unknown"
                    )}
                  </span>

                  <span class="pill">
                    ${escapeHtml(
                      item.browser ||
                      "Unknown"
                    )}
                  </span>

                  <span class="pill">
                    ${escapeHtml(
                      item.country ||
                      "Unknown"
                    )}
                  </span>

                </div>

                <div class="click-time">
                  ${escapeHtml(
                    formatDate(
                      item.time
                    )
                  )}
                </div>

                <div class="click-info">
                  Language:
                  ${escapeHtml(
                    item.language ||
                    "-"
                  )}
                  <br>

                  Referrer:
                  ${escapeHtml(
                    item.referrer ||
                    "-"
                  )}
                </div>

              </div>
            `
        )
        .join("");
  }

  clickModal.classList.remove(
    "hidden"
  );
}

function closeClickModal() {

  clickModal.classList.add(
    "hidden"
  );
}

refreshButton.addEventListener(
  "click",
  loadDashboard
);

document
  .getElementById(
    "closeEdit"
  )
  .addEventListener(
    "click",
    closeEditModal
  );

document
  .getElementById(
    "cancelEdit"
  )
  .addEventListener(
    "click",
    closeEditModal
  );

document
  .getElementById(
    "closeClicks"
  )
  .addEventListener(
    "click",
    closeClickModal
  );

logoutButton.addEventListener(
  "click",
  async () => {

    try {

      await api(
        API_URL,
        {
          method: "POST",

          body:
            JSON.stringify({
              action: "logout"
            })
        }
      );

    } catch {

    }

    allLinks = [];

    showLogin();

    showToast(
      "Berhasil logout."
    );
  }
);

editModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      editModal
    ) {

      closeEditModal();
    }

  }
);

clickModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      clickModal
    ) {

      closeClickModal();
    }

  }
);

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key !== "Escape"
    ) {
      return;
    }

    closeEditModal();

    closeClickModal();
  }
);

checkSession();
