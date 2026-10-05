const API_URL = "/api/shortlink";
const STORAGE_KEY = "dimzlink_pending_create_v1";
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "create";
const title = document.querySelector("#verifyTitle");
const message = document.querySelector("#verifyMessage");
const wrap = document.querySelector("#recaptchaWrap");
const status = document.querySelector("#verifyStatus");
const spinner = document.querySelector("#verifySpinner");
const createButton = document.querySelector("#createLinkBtn");
let recaptchaToken = "";
let submitted = false;

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = `verify-status ${type}`;
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
  const response = await fetch(`${API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat verifikasi.");
  return data;
}
async function createAfterVerification() {
  if (submitted || !recaptchaToken) return;
  submitted = true;
  createButton.disabled = true;
  spinner.classList.add("show");
  setStatus("Memvalidasi verifikasi dan membuat shortlink...", "success");
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("Data pembuatan shortlink tidak ditemukan. Silakan ulangi dari halaman utama.");
    const payload = JSON.parse(raw);
    const response = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ownerKey: localStorage.getItem("dimzlink_owner_key_v2") || "", ...payload, recaptchaToken })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Gagal membuat shortlink.");
    sessionStorage.removeItem(STORAGE_KEY);
    if (data.recoveryCode) localStorage.setItem("dimzlink_recovery_code_v1", data.recoveryCode);
    location.replace(`/shortlink?created=${encodeURIComponent(data.link.alias)}`);
  } catch (error) {
    submitted = false; spinner.classList.remove("show");
    setStatus(error.message || "Gagal membuat shortlink.", "error");
    createButton.disabled = !recaptchaToken;
  }
}
async function start() {
  createButton.addEventListener("click", createAfterVerification);
  if (mode !== "create") {
    title.textContent = "Security Verification";
    message.textContent = "Verify that you are human to continue.";
    createButton.textContent = "Continue";
  }
  try {
    const config = await getConfig();
    if (!config.verificationEnabled) {
      if (mode === "create") {
        recaptchaToken = "disabled";
        await createAfterVerification();
      }
      return;
    }
    if (!config.recaptchaSiteKey) throw new Error("reCAPTCHA site key belum dikonfigurasi.");
    await loadRecaptcha();
    window.grecaptcha.render(wrap, {
      sitekey: config.recaptchaSiteKey,
      callback: token => {
        recaptchaToken = token;
        createButton.disabled = false;
        createButton.style.opacity = "1";
        createButton.style.cursor = "pointer";
        setStatus("Verifikasi berhasil. Tekan tombol untuk melanjutkan.", "success");
      },
      "expired-callback": () => {
        recaptchaToken = ""; createButton.disabled = true;
        createButton.style.opacity = ".55";
        setStatus("Verifikasi kedaluwarsa. Silakan centang kembali.", "error");
      },
      "error-callback": () => {
        recaptchaToken = ""; createButton.disabled = true;
        setStatus("reCAPTCHA gagal dimuat. Periksa koneksi lalu coba lagi.", "error");
      }
    });
  } catch (error) { setStatus(error.message || "Gagal memuat verifikasi.", "error"); }
}
start();
