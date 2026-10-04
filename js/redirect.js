import { getPublicLink, verifyPassword, trackClick } from "./api.js";
import { CONFIG } from "./config.js";
import { $, sleep } from "./utils.js";

let currentAlias = "", currentToken = "", verificationEnabled = false, recaptchaToken = "", protectedLink = false;
function setStatus(message, type = "") { const el = $("#redirectStatus"); if (el) { el.textContent = message; el.className = `status ${type}`; } }
function showError(title, message) {
  $("#redirectTitle").textContent = title; $("#redirectMessage").textContent = message;
  $("#countdown")?.classList.add("hidden"); $("#recaptchaWrap")?.classList.add("hidden");
  $("#continueBtn")?.classList.add("hidden"); $("#passwordPanel")?.classList.add("hidden"); setStatus(message, "error");
}
function loadRecaptcha() {
  return new Promise((resolve, reject) => {
    if (window.grecaptcha?.render) return resolve();
    window.onRecaptchaLoaded = resolve;
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoaded&render=explicit";
    script.async = true; script.defer = true; script.onerror = reject; document.head.appendChild(script);
  });
}
async function getConfig() {
  const response = await fetch(`${CONFIG.API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat konfigurasi."); return data;
}
async function redirectNow() {
  const button = $("#continueBtn");
  if (verificationEnabled && !recaptchaToken) { setStatus("Selesaikan reCAPTCHA terlebih dahulu.", "error"); return; }
  if (button) { button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan...`; }
  try {
    setStatus("Memvalidasi dan menyiapkan tujuan...", "");
    const result = await trackClick(currentAlias, currentToken, recaptchaToken);
    if (!result?.destination) throw new Error("Destination tidak tersedia.");
    setStatus("Mengarahkan...", "success"); await sleep(120); window.location.replace(result.destination);
  } catch (error) {
    if (button) { button.disabled = !recaptchaToken && verificationEnabled; button.innerHTML = `<i class="fa-solid fa-arrow-right"></i> Continue`; }
    setStatus(error?.data?.error || error?.message || "Gagal membuka destination.", "error");
  }
}
async function startVerification() {
  const button = $("#continueBtn");
  if (!verificationEnabled) { if (button) button.classList.add("hidden"); await redirectNow(); return; }
  const wrap = $("#recaptchaWrap"); if (!wrap) return;
  wrap.classList.remove("hidden"); button?.classList.remove("hidden"); if (button) button.disabled = true;
  button?.addEventListener("click", redirectNow, { once: false }); setStatus("Centang reCAPTCHA, lalu tekan Continue.");
  try {
    const config = await getConfig(); if (!config.recaptchaSiteKey) throw new Error("reCAPTCHA site key belum dikonfigurasi.");
    await loadRecaptcha();
    window.grecaptcha.render(wrap, {
      sitekey: config.recaptchaSiteKey,
      callback: token => { recaptchaToken = token; if (button) button.disabled = false; setStatus("Verifikasi berhasil. Tekan Continue.", "success"); },
      "expired-callback": () => { recaptchaToken = ""; if (button) button.disabled = true; setStatus("Verifikasi kedaluwarsa. Silakan centang kembali.", "error"); },
      "error-callback": () => { recaptchaToken = ""; if (button) button.disabled = true; setStatus("reCAPTCHA gagal dimuat. Coba lagi.", "error"); }
    });
  } catch (error) { setStatus(error.message || "Gagal memuat verifikasi.", "error"); }
}
async function submitPassword() {
  const input = $("#redirectPassword"), button = $("#verifyPassword"), password = input?.value?.trim() || "";
  if (!password) { setStatus("Masukkan password terlebih dahulu.", "error"); return; }
  button.disabled = true; button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking...`;
  try {
    const result = await verifyPassword(currentAlias, password); currentToken = result?.accessToken || ""; protectedLink = false;
    $("#passwordPanel")?.classList.add("hidden"); $("#redirectMessage").textContent = "Password benar. Verifikasi keamanan diperlukan.";
    setStatus("Password berhasil diverifikasi.", "success"); await startVerification();
  } catch (error) { setStatus(error?.data?.error || error?.message || "Password salah.", "error"); }
  finally { button.disabled = false; button.innerHTML = `<i class="fa-solid fa-unlock"></i> Verify Password`; }
}
export async function initRedirect(alias) {
  currentAlias = alias; currentToken = ""; recaptchaToken = ""; protectedLink = false;
  $("#verifyPassword")?.addEventListener("click", submitPassword);
  $("#redirectPassword")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitPassword(); } });
  try {
    const [result, config] = await Promise.all([getPublicLink(alias), getConfig()]); const link = result?.link;
    if (!link) throw new Error("Shortlink tidak ditemukan."); verificationEnabled = Boolean(config.verificationEnabled); protectedLink = Boolean(link.passwordProtected);
    if (protectedLink) {
      $("#redirectTitle").textContent = "Password required"; $("#redirectMessage").textContent = "Link ini dilindungi password.";
      $("#countdown")?.classList.add("hidden"); $("#recaptchaWrap")?.classList.add("hidden"); $("#continueBtn")?.classList.add("hidden"); $("#passwordPanel")?.classList.remove("hidden");
      setStatus("Masukkan password untuk melanjutkan."); return;
    }
    $("#redirectTitle").textContent = verificationEnabled ? "Security Verification" : "Preparing your link";
    $("#redirectMessage").textContent = verificationEnabled ? "Verify that you are human to continue." : "Tunggu sebentar, link kamu sedang disiapkan.";
    await startVerification();
  } catch (error) {
    console.error(error);
    if (error?.status === 404) return showError("Link tidak ditemukan", "Shortlink ini tidak tersedia atau mungkin sudah dihapus.");
    if (error?.status === 410) return showError("Link sudah expired", "Shortlink ini sudah tidak aktif karena masa berlakunya telah berakhir.");
    showError("Terjadi kesalahan", error?.data?.error || error?.message || "Gagal memuat shortlink.");
  }
}
