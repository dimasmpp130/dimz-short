import { CONFIG } from "./config.js";

export const $ = (selector, root = document) =>
  root.querySelector(selector);

export const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function randomString(length = 8) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  const array = new Uint32Array(length);

  crypto.getRandomValues(array);

  return [...array]
    .map((n) => chars[n % chars.length])
    .join("");
}

export function randomAlias(length = 6) {
  return randomString(length);
}

export function getOwnerKey() {
  let key = localStorage.getItem(CONFIG.OWNER_KEY);

  if (!key) {
    key = `${randomString(18)}${Date.now().toString(36)}`;
    localStorage.setItem(CONFIG.OWNER_KEY, key);
  }

  return key;
}

export function getShortUrl(alias) {
  return `${window.location.origin}/${encodeURIComponent(alias)}`;
}

export function getAliasFromLocation() {
  const params = new URLSearchParams(window.location.search);

  const queryAlias =
    params.get("alias") ||
    params.get("s");

  if (queryAlias) {
    return sanitizeAlias(queryAlias);
  }

  const pathname = window.location.pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (
    pathname &&
    pathname !== "shortlink" &&
    pathname !== "shortlink.html" &&
    !pathname.includes(".")
  ) {
    return sanitizeAlias(pathname);
  }

  return null;
}

export function sanitizeAlias(value) {
  return String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, CONFIG.ALIAS_MAX);
}

export function validAlias(value) {
  return new RegExp(
    `^[A-Za-z0-9_-]{${CONFIG.ALIAS_MIN},${CONFIG.ALIAS_MAX}}$`
  ).test(value);
}

export function validUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

export function parseJSON(value, fallback = {}) {
  if (!value || !String(value).trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return parsed;
    }

    throw new Error("JSON harus berupa object.");
  } catch {
    throw new Error("Format JSON tidak valid.");
  }
}

export function formatDate(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.select();

  const result = document.execCommand("copy");

  textarea.remove();

  return result;
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = {
      ok: false,
      error: "Server mengembalikan response tidak valid."
    };
  }

  if (!response.ok || data?.ok === false) {
    const error = new Error(
      data?.error ||
      `Request gagal (${response.status})`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export function toast(message, duration = 2400) {
  const element = $("#toast");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.classList.remove("show");
  }, duration);
}

export function setLoading(button, loading, loadingText = "Loading...") {
  if (!button) {
    return;
  }

  if (loading) {
    button.dataset.oldHtml = button.innerHTML;
    button.dataset.loading = "true";
    button.disabled = true;
    button.innerHTML =
      `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(loadingText)}`;
  } else {
    button.disabled = false;

    if (button.dataset.oldHtml) {
      button.innerHTML = button.dataset.oldHtml;
      delete button.dataset.oldHtml;
    }

    delete button.dataset.loading;
  }
}

export function saveLocalLinks(links) {
  try {
    localStorage.setItem(
      CONFIG.CACHE_KEY,
      JSON.stringify(links)
    );
  } catch {

  }
}

export function loadLocalLinks() {
  try {
    const raw = localStorage.getItem(CONFIG.CACHE_KEY);

    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {

    const existing = document.querySelector(
      `script[data-dynamic-src="${src}"]`
    );

    if (existing) {
      if (window.QRCode) {
        resolve();
        return;
      }

      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");

    script.src = src;
    script.async = true;
    script.dataset.dynamicSrc = src;

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Gagal memuat QR library."));

    document.head.appendChild(script);
  });
}

export function selectExpiration(value) {
  const now = Date.now();

  switch (value) {
    case "1d":
      return new Date(now + 86400000).toISOString();

    case "7d":
      return new Date(now + 7 * 86400000).toISOString();

    case "30d":
      return new Date(now + 30 * 86400000).toISOString();

    default:
      return null;
  }
}

export function isExpired(expiresAt) {
  return Boolean(
    expiresAt &&
    Date.parse(expiresAt) <= Date.now()
  );
}
