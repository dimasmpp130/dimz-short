import { getPublicLink, verifyPassword, trackClick } from "./api.js";
import { CONFIG } from "./config.js";
import { $, sleep } from "./utils.js";

let currentAlias = "";
let currentToken = "";
let recaptchaToken = "";
let protectedLink = false;
let countdownTimer = null;

function setStatus(message, type = "") {
  const el = $("#redirectStatus");
  if (el) { el.textContent = message; el.className = `status ${type}`; }
}

function showError(title, message) {
  $("#redirectTitle").textContent = title;
  $("#redirectMessage").textContent = message;
  $("#countdown")?.classList.add("hidden");
  $("#countdownLabel")?.classList.add("hidden");
  $("#recaptchaWrap")?.classList.add("hidden");
  $("#continueBtn")?.classList.add("hidden");
  $("#passwordPanel")?.classList.add("hidden");
  setStatus(message, "error");
}

function loadRecaptcha() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.render) return resolve();
    window.onRecaptchaLoaded = resolve;
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit";
    script.async = true; script.defer = true; script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function getConfig() {
  const response = await fetch(`${CONFIG.API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat verifikasi.");
  return data;
}

async function startCountdown() {
  clearInterval(countdownTimer);
  const seconds = Math.max(0, Math.floor(Number(CONFIG.COUNTDOWN_SECONDS) || 0));
  const countdown = $("#countdown");
  const label = $("#countdownLabel");
  if (seconds <= 0) { label?.classList.add("hidden"); return; }
  label?.classList.remove("hidden"); countdown?.classList.remove("hidden");
  let remaining = seconds;
  await new Promise(resolve => {
    const tick = () => {
      if (countdown) countdown.textContent = String(remaining);
      if (remaining <= 0) { clearTimeout(countdownTimer); resolve(); return; }
      remaining--; countdownTimer = setTimeout(tick, 1000);
    };
    tick();
  });
  label?.classList.add("hidden"); countdown?.classList.add("hidden");
}

function canContinue() {
  const passwordReady = !protectedLink || Boolean($("#redirectPassword")?.value?.trim());
  return passwordReady && Boolean(recaptchaToken);
}

function updateContinueState() {
  const button = $("#continueBtn");
  if (button) button.disabled = !canContinue();
}

async function renderCaptcha() {
  const wrap = $("#recaptchaWrap");
  const button = $("#continueBtn");
  if (!wrap || !button) return;

  wrap.classList.remove("hidden");
  button.classList.remove("hidden");
  button.disabled = true;
  setStatus("Silakan selesaikan CAPTCHA untuk melanjutkan.");

  try {
    const config = await getConfig();
    if (!config.recaptchaSiteKey) throw new Error("CAPTCHA belum dikonfigurasi. Hubungi admin.");
    await loadRecaptcha();
    window.grecaptcha.render(wrap, {
      sitekey: config.recaptchaSiteKey,
      callback: token => {
        recaptchaToken = token;
        updateContinueState();
        setStatus(protectedLink ? "CAPTCHA berhasil. Masukkan password jika diperlukan, lalu lanjutkan." : "CAPTCHA berhasil. Link siap diarahkan.", "success");
      },
      "expired-callback": () => {
        recaptchaToken = ""; updateContinueState();
        setStatus("CAPTCHA kedaluwarsa. Silakan ulangi.", "error");
      },
      "error-callback": () => {
        recaptchaToken = ""; updateContinueState();
        setStatus("CAPTCHA gagal dimuat. Silakan refresh halaman.", "error");
      }
    });
  } catch (error) {
    setStatus(error.message || "Gagal memuat CAPTCHA.", "error");
  }
}

async function redirectNow() {
  if (!canContinue()) {
    setStatus(protectedLink && !$("#redirectPassword")?.value?.trim() ? "Masukkan password terlebih dahulu." : "Selesaikan CAPTCHA terlebih dahulu.", "error");
    return;
  }

  const button = $("#continueBtn");
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...`;

  try {
    setStatus("Pemeriksaan keamanan selesai. Menyiapkan tujuan...");
    if (protectedLink && !currentToken) {
      const result = await verifyPassword(currentAlias, $("#redirectPassword").value.trim());
      currentToken = result?.accessToken || "";
      if (!currentToken) throw new Error("Password verification gagal.");
    }
    const result = await trackClick(currentAlias, currentToken, recaptchaToken);
    if (!result?.destination) throw new Error("Tujuan tidak tersedia.");
    setStatus("Mengarahkan...", "success");
    await sleep(120);
    window.location.replace(result.destination);
  } catch (error) {
    currentToken = protectedLink ? "" : currentToken;
    button.disabled = false;
    button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Lanjutkan`;
    setStatus(error?.data?.error || error?.message || "Gagal membuka tujuan.", "error");
    if (/CAPTCHA|verifikasi/i.test(error?.message || "")) recaptchaToken = "";
  }
}

export async function initRedirect(alias) {
  currentAlias = alias;
  currentToken = "";
  recaptchaToken = "";

  $("#redirectPassword")?.addEventListener("input", updateContinueState);
  $("#redirectPassword")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); redirectNow(); } });
  $("#continueBtn")?.addEventListener("click", redirectNow);

  try {
    const result = await getPublicLink(alias);
    const link = result?.link;
    if (!link) throw new Error("Shortlink tidak ditemukan.");
    protectedLink = Boolean(link.passwordProtected);

    $("#redirectTitle").textContent = "Menyiapkan Link...";
    $("#redirectMessage").textContent = protectedLink
      ? "Pemeriksaan keamanan otomatis sedang disiapkan. Setelah itu masukkan password dan lanjutkan."
      : "Pemeriksaan keamanan otomatis sedang disiapkan. Setelah itu link akan siap diarahkan.";
    if (protectedLink) $("#passwordPanel")?.classList.remove("hidden");

    await startCountdown();
    $("#redirectTitle").textContent = "Pemeriksaan Keamanan";
    $("#redirectMessage").textContent = protectedLink ? "Selesaikan CAPTCHA dan masukkan password untuk membuka link." : "Selesaikan CAPTCHA untuk membuka link.";
    await renderCaptcha();
  } catch (error) {
    console.error(error);
    if (error?.status === 404) return showError("Link tidak ditemukan", "Shortlink ini tidak tersedia.");
    if (error?.status === 410) return showError("Link sudah kedaluwarsa", "Shortlink ini sudah tidak aktif.");
    if (error?.status === 423) return showError("Link sedang dijeda", "Pemilik shortlink sedang menjeda link ini.");
    showError("Terjadi kesalahan", error?.data?.error || error?.message || "Gagal memuat shortlink.");
  }
}
