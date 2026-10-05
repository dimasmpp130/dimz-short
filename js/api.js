import { CONFIG } from "./config.js";
import { apiFetch } from "./utils.js";

export async function createLink(payload) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create", ...payload })
  });
}

export async function updateLink(alias, payload) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", alias, ...payload })
  });
}

export async function setLinkState(alias, paused) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "state", alias, paused })
  });
}

export async function deleteLink(alias) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", alias })
  });
}

export async function listLinks() {
  return apiFetch(`${CONFIG.API_URL}?action=list`);
}

export async function getPublicLink(alias) {
  return apiFetch(`${CONFIG.API_URL}?alias=${encodeURIComponent(alias)}`);
}

export async function verifyPassword(alias, password, recaptchaToken = "") {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", alias, password, recaptchaToken })
  });
}

export async function trackClick(alias, accessToken = "", recaptchaToken = "") {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "track", alias, accessToken, recaptchaToken })
  });
}
