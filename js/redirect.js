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
  sleep
} from "./utils.js";

let currentAlias = "";
let currentToken = "";

let countdownFinished = false;
let verificationChecked = false;
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
  const titleElement = $("#redirectTitle");
  const messageElement = $("#redirectMessage");
  const countdown = $("#countdown");
  const botWrap = $("#botCheckWrap");
  const continueBtn = $("#continueBtn");
  const passwordPanel = $("#passwordPanel");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (messageElement) {
    messageElement.textContent = message;
  }

  countdown?.classList.add("hidden");
  botWrap?.classList.add("hidden");
  continueBtn?.classList.add("hidden");
  passwordPanel?.classList.add("hidden");

  setStatus(message, "error");
}

function updateContinueButton() {
  const button = $("#continueBtn");

  if (!button) {
    return;
  }

  button.disabled = !(
    countdownFinished &&
    verificationChecked
  );
}

async function startCountdown() {
  const countdown = $("#countdown");
  const botWrap = $("#botCheckWrap");
  const continueBtn = $("#continueBtn");

  if (!countdown) {
    return;
  }

  countdownFinished = false;
  verificationChecked = false;

  countdown.classList.remove("hidden");
  botWrap?.classList.remove("hidden");

  if (continueBtn) {
    continueBtn.classList.remove("hidden");
    continueBtn.disabled = true;
    continueBtn.innerHTML =
      `<i class="fa-solid fa-arrow-right"></i> Lanjutkan`;
  }

  const totalSeconds = Math.max(
    0,
    Number(CONFIG.COUNTDOWN_SECONDS) || 0
  );

  if (totalSeconds === 0) {
    countdown.textContent = "✓";
    countdownFinished = true;

    updateContinueButton();

    setStatus(
      "Centang verifikasi lalu lanjutkan.",
      "success"
    );

    return;
  }

  for (
    let seconds = totalSeconds;
    seconds > 0;
    seconds--
  ) {
    countdown.textContent = seconds;

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

  const password = input?.value?.trim() || "";

  if (!password) {
    setStatus(
      "Masukkan password terlebih dahulu.",
      "error"
    );

    return;
  }

  if (button) {
    button.disabled = true;

    button.innerHTML =
      `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
  }

  try {
    const result = await verifyPassword(
      currentAlias,
      password
    );

    currentToken =
      result?.accessToken || "";

    protectedLink = false;

    $("#passwordPanel")?.classList.add("hidden");

    const message = $("#redirectMessage");

    if (message) {
      message.textContent =
        "Password benar. Menyiapkan link...";
    }

    setStatus(
      "Password berhasil diverifikasi.",
      "success"
    );

    await startCountdown();

  } catch (error) {
    setStatus(
      error?.data?.error ||
      error?.message ||
      "Password salah.",
      "error"
    );

  } finally {
    if (button) {
      button.disabled = false;

      button.innerHTML =
        `<i class="fa-solid fa-unlock"></i> Verify Password`;
    }
  }
}

async function continueRedirect() {
  const button = $("#continueBtn");

  if (!button) {
    return;
  }

  if (
    !countdownFinished ||
    !verificationChecked
  ) {
    return;
  }

  button.disabled = true;

  button.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...`;

  setStatus(
    "Mencatat klik...",
    ""
  );

  try {
    const result = await recordClick(
      currentAlias,
      currentToken
    );

    if (!result?.destination) {
      throw new Error(
        "Destination tidak tersedia."
      );
    }

    setStatus(
      "Mengarahkan...",
      "success"
    );

    await sleep(150);

    window.location.replace(
      result.destination
    );

  } catch (error) {
    console.error(error);

    button.disabled = false;

    button.innerHTML =
      `<i class="fa-solid fa-arrow-right"></i> Lanjutkan`;

    setStatus(
      error?.data?.error ||
      error?.message ||
      "Gagal membuka destination.",
      "error"
    );
  }
}

function attachInteractionListeners() {
  const botCheck = $("#botCheck");
  const continueBtn = $("#continueBtn");
  const verifyButton = $("#verifyPassword");
  const passwordInput = $("#redirectPassword");

  botCheck?.addEventListener(
    "change",
    event => {
      verificationChecked =
        Boolean(event.target.checked);

      updateContinueButton();

      if (verificationChecked) {
        setStatus(
          countdownFinished
            ? "Verifikasi berhasil. Silakan lanjutkan."
            : "Verifikasi berhasil. Tunggu countdown selesai.",
          "success"
        );
      } else {
        setStatus(
          "Centang verifikasi lalu lanjutkan.",
          ""
        );
      }
    }
  );

  continueBtn?.addEventListener(
    "click",
    continueRedirect
  );

  verifyButton?.addEventListener(
    "click",
    submitPassword
  );

  passwordInput?.addEventListener(
    "keydown",
    event => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitPassword();
      }
    }
  );
}

export async function initRedirect(alias) {
  currentAlias = alias;

  countdownFinished = false;
  verificationChecked = false;
  currentToken = "";
  protectedLink = false;

  attachInteractionListeners();

  try {
    const result =
      await getPublicLink(alias);

    const link = result?.link;

    if (!link) {
      throw new Error(
        "Shortlink tidak ditemukan."
      );
    }

    protectedLink =
      Boolean(link.passwordProtected);

    const continueBtn = $("#continueBtn");
    const botWrap = $("#botCheckWrap");
    const countdown = $("#countdown");
    const passwordPanel = $("#passwordPanel");

    if (protectedLink) {
      $("#redirectTitle").textContent =
        "Password required";

      $("#redirectMessage").textContent =
        "Link ini dilindungi password.";

      countdown?.classList.add("hidden");
      botWrap?.classList.add("hidden");
      continueBtn?.classList.add("hidden");

      passwordPanel?.classList.remove("hidden");

      setStatus(
        "Masukkan password untuk melanjutkan.",
        ""
      );

      return;
    }

    $("#redirectTitle").textContent =
      "Preparing your link";

    $("#redirectMessage").textContent =
      "Tunggu sebentar, link kamu sedang disiapkan.";

    await startCountdown();

  } catch (error) {
    console.error(error);

    if (error?.status === 404) {
      showError(
        "Link tidak ditemukan",
        "Shortlink ini tidak tersedia atau mungkin sudah dihapus."
      );

      setStatus(
        "Periksa kembali alamat shortlink atau minta link baru.",
        ""
      );

      return;
    }

    if (error?.status === 410) {
      showError(
        "Link sudah expired",
        "Shortlink ini sudah melewati masa berlaku."
      );

      setStatus(
        "Silakan gunakan link yang masih aktif.",
        ""
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
