const API_URL = "/api/shortlink";
const STORAGE_KEY = "dimzlink_pending_create_v1";
const params = new URLSearchParams(location.search);
const mode = params.get("mode") || "create";
const title = document.querySelector("#verifyTitle");
const message = document.querySelector("#verifyMessage");
const wrap = document.querySelector("#turnstileWrap");
const status = document.querySelector("#verifyStatus");
const spinner = document.querySelector("#verifySpinner");
let siteKey = "";
let submitted = false;

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = `verify-status ${type}`;
}

function loadScript() {
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
  const response = await fetch(`${API_URL}?action=config`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Gagal memuat verifikasi.");
  return data;
}

async function createAfterVerification(token) {
  if (submitted) return;
  submitted = true;
  spinner.classList.add("show");
  setStatus("Verifikasi berhasil. Membuat shortlink...", "success");
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("Data pembuatan shortlink tidak ditemukan.");
    const payload = JSON.parse(raw);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ownerKey: localStorage.getItem("dimzlink_owner_key_v2") || "", ...payload, turnstileToken: token })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Gagal membuat shortlink.");
    sessionStorage.removeItem(STORAGE_KEY);
    location.replace(`/shortlink?created=${encodeURIComponent(data.link.alias)}`);
  } catch (error) {
    submitted = false;
    spinner.classList.remove("show");
    setStatus(error.message || "Gagal membuat shortlink.", "error");
    if (window.turnstile && window.turnstileWidgetId !== undefined) window.turnstile.reset(window.turnstileWidgetId);
  }
}

async function start() {
  if (mode !== "create") {
    title.textContent = "Security Verification";
    message.textContent = "Verifikasi berhasil diproses.";
  }
  try {
    const config = await getConfig();
    if (!config.verificationEnabled) {
      if (mode === "create") {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error("Data pembuatan shortlink tidak ditemukan.");
        const payload = JSON.parse(raw);
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", ownerKey: localStorage.getItem("dimzlink_owner_key_v2") || "", ...payload })
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Gagal membuat shortlink.");
        sessionStorage.removeItem(STORAGE_KEY);
        location.replace(`/shortlink?created=${encodeURIComponent(data.link.alias)}`);
      }
      return;
    }
    if (!config.turnstileSiteKey) throw new Error("Turnstile site key belum dikonfigurasi.");
    siteKey = config.turnstileSiteKey;
    await loadScript();
    window.turnstileWidgetId = window.turnstile.render(wrap, {
      sitekey: siteKey,
      theme: "auto",
      callback: createAfterVerification,
      "expired-callback": () => setStatus("Verifikasi kedaluwarsa. Silakan ulangi.", "error"),
      "error-callback": () => setStatus("Verifikasi gagal. Silakan coba lagi.", "error")
    });
  } catch (error) {
    setStatus(error.message || "Gagal memuat verifikasi.", "error");
  }
}

start();
