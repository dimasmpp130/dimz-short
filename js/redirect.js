import { getPublicLink, verifyPassword, trackClick } from "./api.js";
import { CONFIG } from "./config.js";
import { $, sleep } from "./utils.js";

const t = (key, params) => {
  return window.DIMZ_I18N && window.DIMZ_I18N.t
    ? window.DIMZ_I18N.t(key, params)
    : key;
};

let currentAlias = "";
let currentToken = "";
let turnstileToken = "";
let protectedLink = false;
let countdownTimer = null;
let countdownFinished = false;
let captchaShown = false;
let turnstileWidgetId = null;

function setStatus(message, type = "") {
  const element = $("#redirectStatus");

  if (!element) return;

  element.textContent = message;
  element.className = `status ${type}`;
}

function showError(title, message) {
  $("#redirectTitle").textContent = title;
  $("#redirectMessage").textContent = message;

  $("#countdown")?.classList.add("hidden");
  $("#countdownLabel")?.classList.add("hidden");
  $("#turnstileWrap")?.classList.add("hidden");
  $("#continueBtn")?.classList.add("hidden");
  $("#passwordPanel")?.classList.add("hidden");
  $("#homeBtn")?.classList.remove("hidden");

  setStatus("");
}

function loadTurnstile() {
  return new Promise((resolve, reject) => {
    if (window.turnstile?.render) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.turnstile?.render) {
        resolve();
      } else {
        reject(new Error("Failed to initialize Cloudflare Turnstile."));
      }
    };

    script.onerror = () => reject(new Error("Failed to load Cloudflare Turnstile."));
    document.head.appendChild(script);
  });
}

async function getConfig() {
  const response = await fetch(`${CONFIG.API_URL}?action=config`, {
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to load verification.");
  }

  return data;
}

async function startCountdown() {
  clearTimeout(countdownTimer);

  const seconds = Math.max(0, Math.floor(Number(CONFIG.COUNTDOWN_SECONDS) || 0));
  const countdown = $("#countdown");
  const label = $("#countdownLabel");

  countdownFinished = false;

  if (seconds <= 0) {
    label?.classList.add("hidden");
    countdown?.classList.add("hidden");
    countdownFinished = true;

    await revealVerification();
    return;
  }

  label?.classList.remove("hidden");
  countdown?.classList.remove("hidden");

  let remaining = seconds;

  await new Promise(resolve => {
    const tick = () => {
      if (countdown) {
        countdown.textContent = String(remaining);
      }

      if (remaining <= 0) {
        clearTimeout(countdownTimer);
        resolve();
        return;
      }

      remaining -= 1;
      countdownTimer = setTimeout(tick, 1000);
    };

    tick();
  });

  label?.classList.add("hidden");
  countdown?.classList.add("hidden");
  countdownFinished = true;

  await revealVerification();
}

async function revealVerification() {
  const passwordPanel = $("#passwordPanel");
  const button = $("#continueBtn");

  if (protectedLink) {
    passwordPanel?.classList.remove("hidden");
  }

  captchaShown = true;
  if (button) {
    button.classList.remove("hidden");
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> ${t("btn_continue")}`;
  }

  setStatus("Waktu tunggu selesai. Selesaikan CAPTCHA" + (protectedLink ? " dan masukkan password" : "") + " untuk melanjutkan.");
  await renderCaptcha();
  updateContinueState();
}

function canContinue() {
  const passwordReady = !protectedLink || Boolean($("#redirectPassword")?.value?.trim());

  return (
    countdownFinished &&
    captchaShown &&
    passwordReady &&
    Boolean(turnstileToken)
  );
}

function updateContinueState() {
  const button = $("#continueBtn");

  if (!button) return;

  button.disabled = captchaShown ? !canContinue() : !countdownFinished;
}

async function renderCaptcha() {
  const wrap = $("#turnstileWrap");
  const button = $("#continueBtn");

  if (!wrap || !button) return;

  wrap.classList.remove("hidden");
  button.classList.remove("hidden");
  button.disabled = true;

  setStatus("CAPTCHA verification is required to continue.");

  try {
    const config = await getConfig();

    if (!config.turnstileSiteKey) {
      throw new Error("CAPTCHA is not configured. Contact admin.");
    }

    await loadTurnstile();

    if (turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      return;
    }

    turnstileWidgetId = window.turnstile.render(wrap, {
      sitekey: config.turnstileSiteKey,
      theme: "light",
      callback: token => {
        turnstileToken = token;
        updateContinueState();

        setStatus(
          protectedLink
            ? "CAPTCHA verified. Please enter the password to continue."
            : "CAPTCHA verified. Please press the button above.",
          "success"
        );
      },
      "expired-callback": () => {
        turnstileToken = "";
        updateContinueState();
        setStatus("CAPTCHA expired. Please try again.", "error");
      },
      "error-callback": () => {
        turnstileToken = "";
        updateContinueState();
        setStatus("Failed to load CAPTCHA. Please refresh the page.", "error");
      }
    });
  } catch (error) {
    setStatus(error.message || "Failed to load CAPTCHA.", "error");
  }
}

async function redirectNow() {
  const button = $("#continueBtn");

  if (!button || !countdownFinished) return;

  if (!captchaShown) {
    captchaShown = true;
    $("#redirectTitle").textContent = t("verify_title");
    $("#redirectMessage").textContent = protectedLink
      ? "Selesaikan verifikasi Cloudflare dan masukkan password untuk membuka link."
      : "Selesaikan verifikasi Cloudflare untuk membuka link.";

    button.disabled = true;
    setStatus("Verifikasi Cloudflare diperlukan sebelum melanjutkan.");

    await renderCaptcha();
    updateContinueState();
    return;
  }

  if (!canContinue()) {
    const passwordMissing = protectedLink && !$("#redirectPassword")?.value?.trim();

    setStatus(
      passwordMissing
        ? "Masukkan password terlebih dahulu."
        : "Selesaikan verifikasi Cloudflare terlebih dahulu.",
      "error"
    );
    return;
  }

  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing...`;

  try {
    setStatus("Security verification successful. Please wait, preparing destination...");

    if (protectedLink && !currentToken) {
      const result = await verifyPassword(
        currentAlias,
        $("#redirectPassword").value.trim()
      );

      currentToken = result?.accessToken || "";

      if (!currentToken) {
        throw new Error("Password verification failed.");
      }
    }

    const result = await trackClick(currentAlias, currentToken, turnstileToken);

    if (!result?.destination) {
      throw new Error("Destination is not available.");
    }

    setStatus("Redirecting...", "success");
    await sleep(120);
    window.location.replace(result.destination);
  } catch (error) {
    currentToken = protectedLink ? "" : currentToken;
    button.disabled = false;
    button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> ${t("btn_continue")}`;

    setStatus(
      error?.data?.error || error?.message || "Failed to open destination.",
      "error"
    );

    if (/CAPTCHA|verifikasi/i.test(error?.message || "")) {
      turnstileToken = "";
      updateContinueState();
    }
  }
}

export async function initRedirect(alias) {
  currentAlias = alias;
  currentToken = "";
  turnstileToken = "";
  countdownFinished = false;
  captchaShown = false;
  turnstileWidgetId = null;

  $("#redirectPassword")?.addEventListener("input", updateContinueState);
  $("#redirectPassword")?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    redirectNow();
  });
  $("#continueBtn")?.addEventListener("click", redirectNow);

  try {
    const result = await getPublicLink(alias);
    const link = result?.link;

    if (!link) {
      throw new Error("Shortlink not found.");
    }

    protectedLink = Boolean(link.passwordProtected);

    $("#redirectTitle").textContent = "Preparing Destination...";
    $("#redirectMessage").textContent = protectedLink
      ? "Security is being verified automatically. After that, enter the password and continue."
      : "Security is being verified automatically. The link will be ready after the process finishes.";

    $("#passwordPanel")?.classList.add("hidden");
    $("#redirectPassword") && ($("#redirectPassword").value = "");
    $("#turnstileWrap")?.classList.add("hidden");

    // Keep Continue hidden until the countdown has finished.
    $("#continueBtn")?.classList.add("hidden");
    $("#continueBtn").disabled = true;

    await startCountdown();

    $("#redirectTitle").textContent = "Security Check";
    $("#redirectMessage").textContent = protectedLink
      ? "Selesaikan verifikasi Cloudflare dan masukkan password untuk membuka link."
      : "Selesaikan verifikasi Cloudflare untuk membuka link.";
  } catch (error) {
    console.error(error);

    if (error?.status === 404) {
      return showError("Link not found", "This shortlink is not available.");
    }

    if (error?.status === 410) {
      return showError("Link expired", "This shortlink is no longer active.");
    }

    if (error?.status === 423) {
      return showError("Link paused", "The owner has paused this shortlink.");
    }

    showError(
      "An error occurred",
      error?.data?.error || error?.message || "Failed to load shortlink."
    );
  }
}
