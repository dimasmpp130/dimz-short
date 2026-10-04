import {
  getPublicLink,
  verifyPassword
} from "./api.js";

import {
  recordClick
} from "./tracking.js";

import {
  CONFIG
} from "./config.js";

import {
  $,
  escapeHtml,
  sleep
} from "./utils.js";

let currentAlias = "";
let currentToken = "";
let countdownFinished = false;
let userInteracted = false;
let protectedLink = false;

function setStatus(message, type = "") {
  const element = $("#redirectStatus");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `status ${type}`;
}

function showError(title, message) {

  $("#redirectTitle").textContent = title;

  $("#redirectMessage").textContent = message;

  $("#countdown").classList.add("hidden");

  $("#botCheckWrap").classList.add("hidden");

  $("#continueBtn").classList.add("hidden");

  $("#passwordPanel").classList.add("hidden");

  setStatus(message, "error");
}

function markInteraction() {
  userInteracted = true;
  updateContinueButton();
}

function updateContinueButton() {

  const button = $("#continueBtn");

  if (!button) {
    return;
  }

  button.disabled =
    !countdownFinished ||
    !userInteracted;
}

async function startCountdown() {

  const countdown = $("#countdown");

  const botWrap = $("#botCheckWrap");

  if (!countdown) {
    return;
  }

  countdown.classList.remove("hidden");

  botWrap.classList.remove("hidden");

  countdownFinished = false;

  for (
    let seconds = CONFIG.COUNTDOWN_SECONDS;
    seconds >= 0;
    seconds--
  ) {

    countdown.textContent = seconds;

    if (seconds === 0) {
      break;
    }

    await sleep(1000);
  }

  countdownFinished = true;

  countdown.textContent = "✓";

  updateContinueButton();

  setStatus(
    "Centang verifikasi lalu lanjutkan.",
    "success"
  );
}

async function submitPassword() {

  const input = $("#redirectPassword");
  const button = $("#verifyPassword");

  const password = input?.value || "";

  if (!password) {
    setStatus("Masukkan password terlebih dahulu.", "error");
    return;
  }

  button.disabled = true;

  button.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;

  try {

    const result =
      await verifyPassword(
        currentAlias,
        password
      );

    currentToken = result.accessToken || "";

    protectedLink = false;

    $("#passwordPanel").classList.add("hidden");

    $("#redirectMessage").textContent =
      "Password benar. Menyiapkan link...";

    setStatus(
      "Password berhasil diverifikasi.",
      "success"
    );

    await startCountdown();

  } catch (error) {

    setStatus(
      error?.data?.error ||
      "Password salah.",
      "error"
    );

  } finally {

    button.disabled = false;

    button.innerHTML =
      `<i class="fa-solid fa-unlock"></i> Verify Password`;
  }
}

async function continueRedirect() {

  const button = $("#continueBtn");

  if (
    !countdownFinished ||
    !userInteracted
  ) {
    return;
  }

  button.disabled = true;

  button.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i> Preparing...`;

  setStatus("Mencatat klik...", "");

  try {

    const result =
      await recordClick(
        currentAlias,
        currentToken
      );

    if (!result.destination) {
      throw new Error("Destination tidak tersedia.");
    }

    setStatus(
      "Mengarahkan...",
      "success"
    );

    await sleep(150);

    window.location.replace(result.destination);

  } catch (error) {

    console.error(error);

    button.disabled = false;

    button.textContent = "Continue";

    setStatus(
      error?.data?.error ||
      error?.message ||
      "Gagal membuka destination.",
      "error"
    );
  }
}

function attachInteractionListeners() {

  [
    document,
    $("#redirectCard")
  ].forEach((element) => {

    if (!element) {
      return;
    }

    [
      "pointerdown",
      "keydown",
      "touchstart"
    ].forEach((eventName) => {

      element.addEventListener(
        eventName,
        markInteraction,
        { passive: true }
      );

    });

  });

  $("#botCheck")?.addEventListener(
    "change",
    (event) => {

      if (event.target.checked) {
        userInteracted = true;
      }

      updateContinueButton();
    }
  );

  $("#continueBtn")?.addEventListener(
    "click",
    continueRedirect
  );

  $("#verifyPassword")?.addEventListener(
    "click",
    submitPassword
  );

  $("#redirectPassword")?.addEventListener(
    "keydown",
    (event) => {

      if (event.key === "Enter") {
        submitPassword();
      }

    }
  );
}

export async function initRedirect(alias) {

  currentAlias = alias;

  attachInteractionListeners();

  try {

    const result =
      await getPublicLink(alias);

    const link = result.link;

    if (!link) {
      throw new Error("Shortlink tidak ditemukan.");
    }

    protectedLink =
      Boolean(link.passwordProtected);

    if (protectedLink) {

      $("#redirectTitle").textContent =
        "Password required";

      $("#redirectMessage").textContent =
        "Link ini dilindungi password.";

      $("#countdown").classList.add("hidden");

      $("#botCheckWrap").classList.add("hidden");

      $("#continueBtn").classList.add("hidden");

      $("#passwordPanel").classList.remove("hidden");

      return;
    }

    $("#redirectTitle").textContent =
      "Preparing your link";

    $("#redirectMessage").textContent =
      "Tunggu sebentar, link kamu sedang disiapkan.";

    await startCountdown();

  } catch (error) {

    console.error(error);

    if (error.status === 404) {

      showError(
        "Link tidak ditemukan",
        "Shortlink tersebut tidak tersedia."
      );

      return;
    }

    if (error.status === 410) {

      showError(
        "Link sudah expired",
        "Shortlink ini sudah melewati masa berlaku."
      );

      return;
    }

    showError(
      "Terjadi kesalahan",
      error?.data?.error ||
      error?.message ||
      "Gagal memuat shortlink."
    );
  }
}