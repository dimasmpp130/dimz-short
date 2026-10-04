import { getPublicLink, verifyPassword, trackClick } from "./api.js";
import { CONFIG } from "./config.js";
import { $, sleep } from "./utils.js";

let currentAlias = "";
let currentToken = "";
let verificationEnabled = false;
let turnstileToken = "";
let turnstileWidgetId;
let protectedLink = false;

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
  $("#botCheckWrap")?.classList.add("hidden");
  $("#turnstileWrap")?.classList.add("hidden");
  $("#continueBtn")?.classList.add("hidden");
  $("#passwordPanel")?.classList.add("hidden");
  setStatus(message, "error");
}

function loadTurnstile() {
  return new Promise((resolve, reject) => {
    if (window.turnstile) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function getConfig() {
  const response = await fetch(`${CONFIG.API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat konfigurasi.");
  return data;
}

async function redirectNow() {
  const button = $("#continueBtn");
  if (button) {
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...`;
  }
  try {
    setStatus("Mencatat klik...", "");
    const result = await trackClick(currentAlias, currentToken, turnstileToken);
    if (!result?.destination) throw new Error("Destination tidak tersedia.");
    setStatus("Mengarahkan...", "success");
    await sleep(120);
    window.location.replace(result.destination);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Lanjutkan`;
    }
    setStatus(error?.data?.error || error?.message || "Gagal membuka destination.", "error");
  }
}

async function startVerification() {
  if (!verificationEnabled) {
    await redirectNow();
    return;
  }
  const wrap = $("#turnstileWrap");
  if (!wrap) return;
  wrap.classList.remove("hidden");
  $("#continueBtn")?.classList.add("hidden");
  setStatus("Verifikasi untuk melanjutkan.");
  try {
    await loadTurnstile();
    const config = await getConfig();
    if (!config.turnstileSiteKey) throw new Error("Turnstile site key belum dikonfigurasi.");
    turnstileWidgetId = window.turnstile.render(wrap, {
      sitekey: config.turnstileSiteKey,
      theme: "auto",
      callback: token => {
        turnstileToken = token;
        setStatus("Verifikasi berhasil. Mengarahkan...", "success");
        redirectNow();
      },
      "expired-callback": () => {
        turnstileToken = "";
        setStatus("Verifikasi kedaluwarsa. Silakan ulangi.", "error");
      },
      "error-callback": () => {
        turnstileToken = "";
        setStatus("Verifikasi gagal. Silakan coba lagi.", "error");
      }
    });
  } catch (error) {
    setStatus(error.message || "Gagal memuat verifikasi.", "error");
  }
}

async function submitPassword() {
  const input = $("#redirectPassword");
  const button = $("#verifyPassword");
  const password = input?.value?.trim() || "";
  if (!password) {
    setStatus("Masukkan password terlebih dahulu.", "error");
    return;
  }
  button.disabled = true;
  button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
  try {
    const result = await verifyPassword(currentAlias, password);
    currentToken = result?.accessToken || "";
    protectedLink = false;
    $("#passwordPanel")?.classList.add("hidden");
    $("#redirectMessage").textContent = "Password benar. Verifikasi keamanan diperlukan.";
    setStatus("Password berhasil diverifikasi.", "success");
    await startVerification();
  } catch (error) {
    setStatus(error?.data?.error || error?.message || "Password salah.", "error");
  } finally {
    button.disabled = false;
    button.innerHTML = `<i class="fa-solid fa-unlock"></i> Verify Password`;
  }
}

function attachInteractionListeners() {
  $("#verifyPassword")?.addEventListener("click", submitPassword);
  $("#redirectPassword")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitPassword();
    }
  });
}

export async function initRedirect(alias) {
  currentAlias = alias;
  currentToken = "";
  turnstileToken = "";
  protectedLink = false;
  attachInteractionListeners();
  try {
    const [result, config] = await Promise.all([getPublicLink(alias), getConfig()]);
    const link = result?.link;
    if (!link) throw new Error("Shortlink tidak ditemukan.");
    verificationEnabled = Boolean(config.verificationEnabled);
    protectedLink = Boolean(link.passwordProtected);
    if (protectedLink) {
      $("#redirectTitle").textContent = "Password required";
      $("#redirectMessage").textContent = "Link ini dilindungi password.";
      $("#countdown")?.classList.add("hidden");
      $("#turnstileWrap")?.classList.add("hidden");
      $("#continueBtn")?.classList.add("hidden");
      $("#passwordPanel")?.classList.remove("hidden");
      setStatus("Masukkan password untuk melanjutkan.");
      return;
    }
    $("#redirectTitle").textContent = verificationEnabled ? "Security Verification" : "Preparing your link";
    $("#redirectMessage").textContent = verificationEnabled ? "Verify that you are human to continue." : "Tunggu sebentar, link kamu sedang disiapkan.";
    await startVerification();
  } catch (error) {
    console.error(error);
    if (error?.status === 404) {
      showError("Link tidak ditemukan", "Shortlink ini tidak tersedia atau mungkin sudah dihapus.");
      return;
    }
    if (error?.status === 410) {
      showError("Link sudah expired", "Shortlink ini sudah tidak aktif karena masa berlakunya telah berakhir.");
      return;
    }
    showError("Terjadi kesalahan", error?.data?.error || error?.message || "Gagal memuat shortlink.");
  }
}
