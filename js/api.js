import { CONFIG } from "./config.js";
import {
  apiFetch,
  getOwnerKey
} from "./utils.js";

export async function createLink(payload) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "create",
      ownerKey: getOwnerKey(),
      ...payload
    })
  });
}

export async function updateLink(alias, payload) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "update",
      alias,
      ownerKey: getOwnerKey(),
      ...payload
    })
  });
}

export async function deleteLink(alias) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "delete",
      alias,
      ownerKey: getOwnerKey()
    })
  });
}

export async function checkDestination(destination) {
  return apiFetch(`${CONFIG.API_URL}?action=checkDestination&destination=${encodeURIComponent(destination)}`);
}

export async function getHealth(alias) {
  return apiFetch(`${CONFIG.API_URL}?action=health&alias=${encodeURIComponent(alias)}&ownerKey=${encodeURIComponent(getOwnerKey())}`);
}

export async function getAnalytics(alias) {
  return apiFetch(`${CONFIG.API_URL}?action=analytics&alias=${encodeURIComponent(alias)}&ownerKey=${encodeURIComponent(getOwnerKey())}`);
}

export async function pauseLink(alias) {
  return apiFetch(CONFIG.API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pause", alias, ownerKey: getOwnerKey() }) });
}

export async function resumeLink(alias) {
  return apiFetch(CONFIG.API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resume", alias, ownerKey: getOwnerKey() }) });
}

export async function recoverWorkspace(code) {
  return apiFetch(`${CONFIG.API_URL}?action=recover&recoveryCode=${encodeURIComponent(code)}`);
}

export async function listLinks() {
  return apiFetch(
    `${CONFIG.API_URL}?action=list&ownerKey=${encodeURIComponent(
      getOwnerKey()
    )}`
  );
}

export async function getPublicLink(alias) {
  return apiFetch(
    `${CONFIG.API_URL}?alias=${encodeURIComponent(alias)}`
  );
}

export async function verifyPassword(alias, password) {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "verify",
      alias,
      password
    })
  });
}

export async function trackClick(alias, accessToken = "", recaptchaToken = "") {
  return apiFetch(CONFIG.API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "track",
      alias,
      accessToken,
      recaptchaToken
    })
  });
}
