import { getPublicLink, verifyPassword, trackClick } from "./api.js";
import { CONFIG } from "./config.js";
import { $, sleep } from "./utils.js";

let currentAlias = "";
let currentToken = "";
let verificationEnabled = false;
let recaptchaToken = "";
let protectedLink = false;
let countdownTimer = null;
let currentLink = null;

function setStatus(message, type = "") {
  const el = $("#redirectStatus");
  if (el) {
    el.textContent = message;
    el.className = `status ${type}`;
  }
}

function showError(title, message) {
  $("#redirectTitle").textContent = title;
  $("#redirectMessage").textContent = message;
  $("#countdown")?.classList.add("hidden");
  $("#countdownLabel")?.classList.add("hidden");
  $("#recaptchaWrap")?.classList.add("hidden");
  $("#continueBtn")?.classList.add("hidden");
  $("#passwordPanel")?.classList.add("hidden");
  $("#shortlinkPreview")?.classList.add("hidden");
  setStatus(message, "error");
}

function loadRecaptcha() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.render) return resolve();

    window.onRecaptchaLoaded = resolve;

    const script = document.createElement("script");
    script.src =
      "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit";
    script.async = true;
    script.defer = true;
    script.onerror = reject;

    document.head.appendChild(script);
  });
}

async function getConfig() {
  const response = await fetch(
    `${CONFIG.API_URL}?action=config`,
    { cache: "no-store" }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Gagal memuat konfigurasi.");
  }

  return data;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || "-";
  }
}

function renderShortlinkPreview(link) {
  const preview = $("#shortlinkPreview");
  if (!preview) return;

  const shortUrl = `${location.origin}/${encodeURIComponent(currentAlias)}`;
  const destination = link?.destination || "";

  preview.classList.remove("hidden");

  $("#previewShortUrl").textContent = shortUrl;
  $("#previewAlias").textContent = `/${currentAlias}`;
  $("#previewDestination").textContent = getHostname(destination);
}

function resetCountdownUI() {
  const countdown = $("#countdown");
  const label = $("#countdownLabel");

  if (countdown) {
    countdown.textContent = String(Math.max(0, Number(CONFIG.COUNTDOWN_SECONDS) || 0));
  }

  label?.classList.remove("hidden");
  countdown?.classList.remove("hidden");
}

function finishCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;

  const countdown = $("#countdown");
  const label = $("#countdownLabel");

  if (countdown) countdown.textContent = "0";
  label?.classList.add("hidden");
  countdown?.classList.add("hidden");
}

function startCountdown() {
  clearInterval(countdownTimer);

  const seconds = Math.max(
    0,
    Math.floor(Number(CONFIG.COUNTDOWN_SECONDS) || 0)
  );

  const countdown = $("#countdown");
  const label = $("#countdownLabel");

  if (seconds <= 0) {
    finishCountdown();
    return Promise.resolve();
  }

  resetCountdownUI();

  let remaining = seconds;

  return new Promise((resolve) => {
    const tick = () => {
      if (countdown) countdown.textContent = String(remaining);

      if (remaining <= 0) {
        finishCountdown();
        resolve();
        return;
      }

      remaining -= 1;
      countdownTimer = setTimeout(tick, 1000);
    };

    tick();
  });
}

async function redirectNow() {
  const button = $("#continueBtn");
  const passwordInput = $("#redirectPassword");

  if (verificationEnabled && !recaptchaToken) {
    setStatus('Centang "Saya bukan robot" atau selesaikan verifikasi terlebih dahulu.', "error");
    return;
  }

  if (protectedLink && !passwordInput?.value?.trim()) {
    setStatus("Masukkan password terlebih dahulu.", "error");
    passwordInput?.focus();
    return;
  }

  if (button) {
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...`;
  }

  try {
    setStatus("Memvalidasi dan menyiapkan tujuan...", "");

    // Password-protected links are verified only when Continue is pressed.
    // This keeps the flow simple: password + reCAPTCHA -> Continue -> redirect.
    if (protectedLink && !currentToken) {
      const result = await verifyPassword(
        currentAlias,
        passwordInput.value.trim()
      );
      currentToken = result?.accessToken || "";

      if (!currentToken) {
        throw new Error("Password verification gagal.");
      }
    }

    const result = await trackClick(
      currentAlias,
      currentToken,
      recaptchaToken
    );

    if (!result?.destination) {
      throw new Error("Destination tidak tersedia.");
    }

    setStatus("Mengarahkan...", "success");
    await sleep(120);
    window.location.replace(result.destination);
  } catch (error) {
    if (protectedLink) {
      currentToken = "";
    }

    if (button) {
      button.disabled = !canContinue();
      button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Continue`;
    }

    setStatus(
      error?.data?.error ||
        error?.message ||
        "Gagal membuka destination.",
      "error"
    );
  }
}

function canContinue() {
  const passwordReady = !protectedLink || Boolean($("#redirectPassword")?.value?.trim());
  // Protected links always require the human verification because the API
  // requires a valid reCAPTCHA token for the final track/redirect request.
  const verificationReady = protectedLink
    ? Boolean(recaptchaToken)
    : (!verificationEnabled || Boolean(recaptchaToken));
  return passwordReady && verificationReady;
}

function updateContinueState() {
  const button = $("#continueBtn");
  if (!button) return;

  button.disabled = !canContinue();
}

async function showVerificationAfterCountdown() {
  const button = $("#continueBtn");
  const wrap = $("#recaptchaWrap");

  if (!verificationEnabled) {
    button?.classList.remove("hidden");

    if (button) {
      button.disabled = false;
      button.innerHTML =
        `<i class="fa-solid fa-arrow-right"></i> Continue`;
    }

    setStatus("Timer selesai. Link siap dibuka.", "success");
    return;
  }

  if (!wrap || !button) return;

  wrap.classList.remove("hidden");
  button.classList.remove("hidden");
  button.disabled = true;

  setStatus(
    'Timer selesai. Centang "Saya bukan robot" untuk melanjutkan.'
  );

  try {
    const config = await getConfig();

    if (!config.recaptchaSiteKey) {
      throw new Error(
        "reCAPTCHA site key belum dikonfigurasi."
      );
    }

    await loadRecaptcha();

    window.grecaptcha.render(wrap, {
      sitekey: config.recaptchaSiteKey,

      callback: (token) => {
        recaptchaToken = token;
        updateContinueState();

        setStatus(
          protectedLink
            ? "Verifikasi berhasil. Pastikan password sudah diisi, lalu tekan Continue."
            : "Verifikasi berhasil. Tombol Continue sudah aktif.",
          "success"
        );
      },

      "expired-callback": () => {
        recaptchaToken = "";
        updateContinueState();

        setStatus(
          'Verifikasi kedaluwarsa. Centang "Saya bukan robot" kembali.',
          "error"
        );
      },

      "error-callback": () => {
        recaptchaToken = "";
        updateContinueState();

        setStatus(
          "reCAPTCHA gagal dimuat. Coba refresh halaman.",
          "error"
        );
      }
    });
  } catch (error) {
    setStatus(
      error.message || "Gagal memuat verifikasi.",
      "error"
    );
  }
}

async function startVerification() {
  const button = $("#continueBtn");

  if (button) {
    button.classList.add("hidden");
    button.disabled = true;
  }

  $("#recaptchaWrap")?.classList.add("hidden");

  setStatus(
    `Tunggu ${Math.max(
      0,
      Math.floor(Number(CONFIG.COUNTDOWN_SECONDS) || 0)
    )} detik sebelum melanjutkan.`
  );

  await startCountdown();
  await showVerificationAfterCountdown();
}

async function submitPassword() {
  updateContinueState();

  const input = $("#redirectPassword");
  if (!input?.value?.trim()) {
    setStatus("Masukkan password terlebih dahulu.", "error");
    input?.focus();
    return;
  }

  if (!recaptchaToken) {
    setStatus('Centang "Saya bukan robot" terlebih dahulu.', "error");
    return;
  }

  redirectNow();
}

export async function initRedirect(alias) {
  currentAlias = alias;
  currentToken = "";
  recaptchaToken = "";
  protectedLink = false;
  currentLink = null;

  $("#verifyPassword")?.addEventListener("click", submitPassword);

  $("#redirectPassword")?.addEventListener("input", updateContinueState);
  $("#redirectPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPassword();
    }
  });

  $("#continueBtn")?.addEventListener(
    "click",
    redirectNow
  );

  try {
    const [result, config] = await Promise.all([
      getPublicLink(alias),
      getConfig()
    ]);

    const link = result?.link;

    if (!link) {
      throw new Error("Shortlink tidak ditemukan.");
    }

    currentLink = link;
    verificationEnabled = Boolean(
      config.verificationEnabled
    );
    protectedLink = Boolean(
      link.passwordProtected
    );

    $("#redirectTitle").textContent = "Preparing Your link";

    if (protectedLink) {
      $("#redirectMessage").textContent =
        "Masukkan password dan centang Saya bukan robot. Setelah keduanya valid, tekan Continue untuk membuka link.";

      $("#countdown")?.classList.add("hidden");
      $("#countdownLabel")?.classList.add("hidden");
      $("#passwordPanel")?.classList.remove("hidden");
      $("#verifyPassword")?.classList.add("hidden");
      $("#recaptchaWrap")?.classList.remove("hidden");
      $("#continueBtn")?.classList.remove("hidden");
      $("#continueBtn").disabled = true;

      if (!verificationEnabled) {
        setStatus("Masukkan password untuk melanjutkan.");
        updateContinueState();
      } else {
        try {
          const cfg = config;
          if (!cfg.recaptchaSiteKey) throw new Error("reCAPTCHA site key belum dikonfigurasi.");
          await loadRecaptcha();
          window.grecaptcha.render($("#recaptchaWrap"), {
            sitekey: cfg.recaptchaSiteKey,
            callback: (token) => {
              recaptchaToken = token;
              updateContinueState();
              setStatus("Verifikasi berhasil. Pastikan password sudah diisi, lalu tekan Continue.", "success");
            },
            "expired-callback": () => {
              recaptchaToken = "";
              updateContinueState();
              setStatus('Verifikasi kedaluwarsa. Centang "Saya bukan robot" kembali.', "error");
            },
            "error-callback": () => {
              recaptchaToken = "";
              updateContinueState();
              setStatus("reCAPTCHA gagal dimuat. Coba refresh halaman.", "error");
            }
          });
        } catch (error) {
          setStatus(error.message || "Gagal memuat verifikasi.", "error");
        }
      }
      return;
    }

    $("#redirectMessage").textContent =
      "Tunggu timer selesai, lalu centang Saya bukan robot untuk melanjutkan.";

    await startVerification();
  } catch (error) {
    console.error(error);

    if (error?.status === 404) {
      return showError(
        "Link tidak ditemukan",
        "Shortlink ini tidak tersedia atau mungkin sudah dihapus."
      );
    }

    if (error?.status === 410) {
      return showError(
        "Link sudah expired",
        "Shortlink ini sudah tidak aktif karena masa berlakunya telah berakhir."
      );
    }

    showError(
      "Terjadi kesalahan",
      error?.data?.error ||
        error?.message ||
        "Gagal memuat shortlink."
    );
  }
}
