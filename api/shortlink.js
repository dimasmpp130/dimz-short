import crypto from "crypto";

const REDIS_URL = process.env.DIMZLINK_KV_REST_API_URL;
const REDIS_TOKEN = process.env.DIMZLINK_KV_REST_API_TOKEN;
const redisEnabled = Boolean(REDIS_URL && REDIS_TOKEN);

const BLOCKED_HOSTS = [
  "dimz-short.vercel.app",
  "link.dimz-wtf.web.id"
];

const RATE = {
  create: { limit: 20, window: 60 * 60 },
  track: { limit: 240, window: 60 * 60 }
};

function json(res, status, data, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  setSecurityHeaders(res);
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self' https://www.google.com https://www.gstatic.com; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://cdnjs.cloudflare.com; frame-src https://www.google.com https://www.gstatic.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; connect-src 'self' https:;");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024
  });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPasswordHash(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length === 6 && parts[0] === "scrypt") {
    const [, n, r, p, saltHex, hashHex] = parts;
    try {
      const derived = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), 64, {
        N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024
      });
      return crypto.timingSafeEqual(derived, Buffer.from(hashHex, "hex"));
    } catch {
      return false;
    }
  }
  // Backward compatibility for old links. Newly created passwords always use scrypt.
  return /^[a-f0-9]{64}$/i.test(String(stored || "")) && safeEqual(sha256(password), stored);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validAlias(alias) {
  return /^[A-Za-z0-9_-]{4,32}$/.test(String(alias || ""));
}

function normalizeAlias(alias) {
  return String(alias || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}

function validUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

function isSuspiciousUrl(value) {
  try {
    const url = new URL(String(value));
    if (String(value).length > 4096) return "URL terlalu panjang.";
    if (url.username || url.password) return "URL dengan kredensial tertanam tidak diizinkan.";
    if (/^(javascript|data|file):/i.test(String(value))) return "Skema URL tidak aman.";
    if (url.hostname.includes("xn--") && url.hostname.length > 100) return "Nama domain terlihat tidak wajar.";
    return "";
  } catch {
    return "URL tidak valid.";
  }
}

function isBlockedUrl(value) {
  try {
    const url = new URL(String(value));
    const hostname = url.hostname.toLowerCase();
    if (isPrivateHostname(hostname)) return true;
    return BLOCKED_HOSTS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return true;
  }
}

function canonicalDestination(value) {
  const url = new URL(String(value).trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return `youtube:${url.pathname.replace(/^\/+/, "")}`;
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    const id = url.searchParams.get("v");
    if (id) return `youtube:${id}`;
    const shorts = url.pathname.match(/^\/shorts\/([^/]+)/i);
    if (shorts) return `youtube:${shorts[1]}`;
  }
  const drop = [];
  for (const key of url.searchParams.keys()) {
    if (key.toLowerCase() === "si" || key.toLowerCase().startsWith("utm_") || ["fbclid","gclid"].includes(key.toLowerCase())) drop.push(key);
  }
  drop.forEach((key) => url.searchParams.delete(key));
  return url.toString().replace(/\/$/, "");
}

function getClientIp(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() || "unknown";
}

function botType(req) {
  const ua = String(req.headers?.["user-agent"] || "");
  return /bot|crawler|spider|slurp|bingpreview|headless|phantom|selenium|curl|wget|python-requests/i.test(ua) ? "bot" : "human";
}

function getWorkspaceCookie(req) {
  const cookie = String(req.headers?.cookie || "");
  const match = cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith("dimz_workspace="));
  return match ? decodeURIComponent(match.slice("dimz_workspace=".length)) : "";
}

function makeWorkspaceCookie() {
  const value = randomToken(24);
  return `dimz_workspace=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
}

function ensureWorkspace(req, res) {
  const existing = getWorkspaceCookie(req);
  if (existing) return existing;
  const value = randomToken(24);
  res.setHeader("Set-Cookie", `dimz_workspace=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
  return value;
}

async function redisCommand(command, ...args) {
  if (!redisEnabled) throw new Error("Redis belum dikonfigurasi.");
  const encoded = args.map((value) => encodeURIComponent(String(value)));
  const response = await fetch(`${REDIS_URL}/${command}/${encoded.join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function redisSetAdd(alias) {
  await redisCommand("SADD", "dimzlink:index", alias);
}

async function redisSetRemove(alias) {
  await redisCommand("SREM", "dimzlink:index", alias);
}

async function getLink(alias) {
  const [raw, clicksRaw] = await Promise.all([
    redisCommand("GET", `dimzlink:${alias}`),
    redisCommand("GET", `dimzlink:clicks:${alias}`)
  ]);
  if (!raw) return null;
  const link = JSON.parse(raw);
  link.clicks = Number(clicksRaw || link.clicks || 0);
  return link;
}

async function saveLink(link) {
  const data = { ...link };
  delete data.clicks;
  await Promise.all([
    redisCommand("SET", `dimzlink:${link.alias}`, JSON.stringify(data)),
    redisCommand("SET", `dimzlink:clicks:${link.alias}`, Number(link.clicks || 0)),
    redisSetAdd(link.alias)
  ]);
}

async function deleteStoredLink(alias) {
  await redisCommand("DEL", `dimzlink:${alias}`);
  await redisCommand("DEL", `dimzlink:clicks:${alias}`);
  await redisCommand("DEL", `dimzlink:events:${alias}`);
  await redisSetRemove(alias);
}

async function listStoredLinks() {
  let aliases = await redisCommand("SMEMBERS", "dimzlink:index");
  aliases = Array.isArray(aliases) ? aliases.map(String) : [];

  // Legacy fallback only: migrate old records into the set, avoiding routine SCAN usage.
  if (!aliases.length) {
    let cursor = "0";
    do {
      const result = await redisCommand("SCAN", cursor, "MATCH", "dimzlink:*", "COUNT", "100");
      cursor = String(result?.[0] ?? "0");
      for (const key of result?.[1] || []) {
        const value = String(key);
        if (!value.startsWith("dimzlink:clicks:") && !value.startsWith("dimzlink:events:") && value !== "dimzlink:index") {
          aliases.push(value.replace(/^dimzlink:/, ""));
        }
      }
    } while (cursor !== "0");
    if (aliases.length) {
      for (const alias of aliases) await redisSetAdd(alias);
    }
  }

  const links = (await Promise.all([...new Set(aliases)].map(async (alias) => {
    try { return await getLink(normalizeAlias(alias)); }
    catch { return null; }
  }))).filter((link) => link?.alias);
  return links;
}

async function getEvents(alias, limit = 500) {
  const raw = await redisCommand("LRANGE", `dimzlink:events:${alias}`, 0, Math.max(0, limit - 1));
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item) => {
    try { return JSON.parse(item); } catch { return null; }
  }).filter(Boolean);
}

function publicLink(link, owner = false) {
  const result = {
    alias: link.alias,
    destination: link.destination,
    expiresAt: link.expiresAt || null,
    createdAt: link.createdAt || null,
    clicks: Number(link.clicks || 0),
    lastClickAt: link.lastClickAt || null,
    passwordProtected: Boolean(link.passwordHash),
    paused: Boolean(link.paused)
  };
  if (owner) result.recentClicks = Array.isArray(link.clickLog) ? link.clickLog.slice(-50) : [];
  return result;
}

function isExpired(link) {
  return Boolean(link.expiresAt && Date.parse(link.expiresAt) <= Date.now());
}

function buildClickData(req) {
  const ua = String(req.headers?.["user-agent"] || "");
  const ip = getClientIp(req);
  const secret = process.env.DIMZLINK_IP_SECRET || "change-this-secret";
  return {
    time: new Date().toISOString(),
    visitor: sha256(`${ip}.${secret}`),
    type: botType(req),
    device: /tablet|ipad/i.test(ua) ? "tablet" : /mobile|android|iphone|ipod/i.test(ua) ? "mobile" : "desktop",
    browser: /Edg\//i.test(ua) ? "Edge" : /OPR\//i.test(ua) ? "Opera" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "Other",
    os: /Windows/i.test(ua) ? "Windows" : /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Other",
    country: String(req.headers?.["x-vercel-ip-country"] || "").toUpperCase() || "Tidak diketahui",
    language: String(req.headers?.["accept-language"] || "").slice(0, 100) || "Tidak diketahui",
    referrer: String(req.headers?.referer || "").slice(0, 500) || "Langsung",
    userAgent: ua.slice(0, 500)
  };
}

async function recordEvent(link, event) {
  if (!Array.isArray(link.clickLog)) link.clickLog = [];
  link.clickLog.push(event);
  link.clickLog = link.clickLog.slice(-100);
  await redisCommand("LPUSH", `dimzlink:events:${link.alias}`, JSON.stringify(event));
  await redisCommand("LTRIM", `dimzlink:events:${link.alias}`, 0, 499);
}

async function rateLimit(req, kind) {
  const cfg = RATE[kind];
  if (!cfg) return true;
  const key = `dimz:rate:${kind}:${sha256(getClientIp(req))}`;
  const count = Number(await redisCommand("INCR", key));
  if (count === 1) await redisCommand("EXPIRE", key, cfg.window);
  if (count > cfg.limit) {
    const error = new Error("Terlalu banyak permintaan. Silakan coba lagi nanti.");
    error.status = 429;
    throw error;
  }
  return true;
}

async function verifyRecaptcha(token, req) {
  const secret = process.env.DIMZLINK_RECAPTCHA_SECRET_KEY;
  if (!secret) {
    const error = new Error("CAPTCHA belum dikonfigurasi oleh admin.");
    error.status = 503;
    throw error;
  }
  if (!token) {
    const error = new Error("CAPTCHA wajib diselesaikan.");
    error.status = 403;
    throw error;
  }
  const form = new URLSearchParams({ secret, response: String(token) });
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) form.set("remoteip", forwarded);
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const error = new Error("CAPTCHA gagal atau sudah kedaluwarsa. Silakan ulangi.");
    error.status = 403;
    throw error;
  }
}

function verificationConfig() {
  return {
    verificationEnabled: true,
    recaptchaSiteKey: process.env.DIMZLINK_RECAPTCHA_SITE_KEY || ""
  };
}

async function generateUniqueAlias() {
  for (let i = 0; i < 20; i++) {
    const alias = randomToken(4).slice(0, 6);
    if (validAlias(alias) && !(await getLink(alias))) return alias;
  }
  throw new Error("Gagal membuat alias otomatis.");
}

function validatePassword(password) {
  if (!password) return;
  if (String(password).length > 128) throw new Error("Password terlalu panjang.");
}

async function enforceDuplicateLimit(destination, req) {
  const canonical = canonicalDestination(destination);
  const key = `dimz:duplicate:${sha256(`${getClientIp(req)}|${canonical}`)}`;
  const count = Number(await redisCommand("INCR", key));
  if (count === 1) await redisCommand("EXPIRE", key, 86400);
  if (count > 3) {
    const error = new Error("Tujuan yang sama sudah mencapai batas 3 kali dalam 24 jam. Batas akan reset otomatis.");
    error.status = 429;
    error.code = "DUPLICATE_DESTINATION_LIMIT";
    throw error;
  }
}

async function createLink(input, req, workspaceId) {
  let alias = normalizeAlias(input.alias);
  if (!alias) alias = await generateUniqueAlias();
  if (!validAlias(alias)) {
    const error = new Error("Alias tidak valid.");
    error.status = 400;
    throw error;
  }
  if (Number(await redisCommand("EXISTS", `dimzlink:${alias}`)) > 0) {
    const error = new Error("Alias sudah digunakan. Pilih alias lain.");
    error.status = 409;
    throw error;
  }

  const destination = String(input.destination || "").trim();
  if (!validUrl(destination)) throw new Error("URL tujuan tidak valid.");
  const suspicious = isSuspiciousUrl(destination);
  if (suspicious) { const e = new Error(`URL tujuan mencurigakan: ${suspicious}`); e.status = 400; e.code = "SUSPICIOUS_URL"; throw e; }
  if (isBlockedUrl(destination)) {
    const error = new Error("URL tujuan diblokir karena alasan keamanan.");
    error.status = 400; error.code = "BLOCKED_DESTINATION"; throw error;
  }

  await enforceDuplicateLimit(destination, req);

  let expiresAt = null;
  if (input.expiresAt) {
    const date = new Date(input.expiresAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Tanggal kedaluwarsa harus berada di masa depan.");
    expiresAt = date.toISOString();
  }

  validatePassword(input.password);
  const link = {
    alias,
    destination,
    expiresAt,
    createdAt: new Date().toISOString(),
    clicks: 0,
    lastClickAt: null,
    workspaceId: sha256(workspaceId),
    passwordHash: input.password ? passwordHash(input.password) : null,
    paused: false,
    clickLog: []
  };
  await saveLink(link);
  return link;
}

function ensureOwner(link, workspaceId) {
  if (!link || link.workspaceId !== sha256(workspaceId)) {
    const error = new Error("Akses workspace tidak valid.");
    error.status = 403;
    throw error;
  }
}

async function updateLink(input, req, workspaceId) {
  const alias = normalizeAlias(input.alias);
  const link = await getLink(alias);
  if (!link) { const e = new Error("Shortlink tidak ditemukan."); e.status = 404; throw e; }
  ensureOwner(link, workspaceId);

  const destination = String(input.destination || "").trim();
  if (!validUrl(destination)) throw new Error("URL tujuan tidak valid.");
  const suspicious = isSuspiciousUrl(destination);
  if (suspicious) { const e = new Error(`URL tujuan mencurigakan: ${suspicious}`); e.status = 400; e.code = "SUSPICIOUS_URL"; throw e; }
  if (isBlockedUrl(destination)) { const e = new Error("URL tujuan diblokir karena alasan keamanan."); e.status = 400; throw e; }

  let expiresAt = null;
  if (input.expiresAt) {
    const date = new Date(input.expiresAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Tanggal kedaluwarsa harus berada di masa depan.");
    expiresAt = date.toISOString();
  }
  link.destination = destination;
  link.expiresAt = expiresAt;
  if (Object.prototype.hasOwnProperty.call(input, "password")) {
    validatePassword(input.password);
    if (String(input.password || "").trim()) link.passwordHash = passwordHash(input.password);
  }
  await saveLink(link);
  return link;
}

async function setState(input, workspaceId) {
  const alias = normalizeAlias(input.alias);
  const link = await getLink(alias);
  if (!link) { const e = new Error("Shortlink tidak ditemukan."); e.status = 404; throw e; }
  ensureOwner(link, workspaceId);
  link.paused = Boolean(input.paused);
  await saveLink(link);
  return link;
}

async function makeAccessToken(alias, passwordHashValue) {
  const expires = Date.now() + 10 * 60 * 1000;
  const secret = process.env.DIMZLINK_TOKEN_SECRET;
  if (!secret) throw new Error("Token secret belum dikonfigurasi.");
  return `${expires}.${sha256(`${alias}.${passwordHashValue}.${expires}.${secret}`)}`;
}

function validateAccessToken(token, alias, passwordHashValue) {
  if (!token) return false;
  const parts = String(token).split(".");
  if (parts.length !== 2) return false;
  const expires = Number(parts[0]);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const secret = process.env.DIMZLINK_TOKEN_SECRET;
  if (!secret) return false;
  return safeEqual(parts[1], sha256(`${alias}.${passwordHashValue}.${expires}.${secret}`));
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 200000) reject(new Error("Request terlalu besar."));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Format permintaan tidak valid.")); }
    });
    req.on("error", reject);
  });
}

async function buildAdminEvents(link) {
  const events = await getEvents(link.alias, 500);
  if (events.length) return events;
  return Array.isArray(link.clickLog) ? [...link.clickLog].reverse() : [];
}

async function handleRequest(req, res) {
  if (!redisEnabled) return json(res, 500, { ok: false, error: "Redis belum dikonfigurasi." });

  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") { setSecurityHeaders(res); res.statusCode = 204; return res.end(); }

  try {
    if (method === "GET") {
      const query = req.query || {};
      const action = String(query.action || "");

      if (action === "config") return json(res, 200, { ok: true, ...verificationConfig() });

      const workspaceId = ensureWorkspace(req, res);

      if (action === "list") {
        const links = await listStoredLinks();
        const owned = links.filter((link) => link.workspaceId === sha256(workspaceId)).map((link) => publicLink(link, true));
        return json(res, 200, { ok: true, links: owned });
      }

      const alias = normalizeAlias(query.alias);
      if (!alias) return json(res, 400, { ok: false, error: "Alias diperlukan." });
      const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link)) return json(res, 410, { ok: false, error: "Shortlink sudah kedaluwarsa.", code: "EXPIRED" });
      if (link.paused) return json(res, 423, { ok: false, error: "Shortlink sedang dijeda.", code: "PAUSED" });
      return json(res, 200, { ok: true, link: publicLink(link) });
    }

    if (method !== "POST") return json(res, 405, { ok: false, error: "Metode tidak didukung." });

    const body = await parseBody(req);
    const action = String(body.action || "");
    const workspaceId = ensureWorkspace(req, res);

    if (action === "create") {
      await rateLimit(req, "create");
      await verifyRecaptcha(body.recaptchaToken, req);
      const link = await createLink(body, req, workspaceId);
      return json(res, 201, { ok: true, link: publicLink(link) });
    }

    if (action === "update") {
      const link = await updateLink(body, req, workspaceId);
      return json(res, 200, { ok: true, link: publicLink(link, true) });
    }

    if (action === "state") {
      const link = await setState(body, workspaceId);
      return json(res, 200, { ok: true, link: publicLink(link, true) });
    }

    if (action === "delete") {
      const alias = normalizeAlias(body.alias);
      const link = await getLink(alias);
      if (!link) {
        const error = new Error("Shortlink tidak ditemukan.");
        error.status = 404;
        throw error;
      }
      ensureOwner(link, workspaceId);
      await deleteStoredLink(alias);
      return json(res, 200, { ok: true, deleted: alias });
    }

    if (action === "verify") {
      const alias = normalizeAlias(body.alias);
      const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link)) return json(res, 410, { ok: false, error: "Shortlink sudah kedaluwarsa." });
      if (link.paused) return json(res, 423, { ok: false, error: "Shortlink sedang dijeda." });
      if (!link.passwordHash) return json(res, 200, { ok: true, accessToken: "" });
      if (!verifyPasswordHash(String(body.password || ""), link.passwordHash)) return json(res, 401, { ok: false, error: "Password salah." });
      return json(res, 200, { ok: true, accessToken: await makeAccessToken(alias, link.passwordHash) });
    }

    if (action === "track") {
      await rateLimit(req, "track");
      const alias = normalizeAlias(body.alias);
      const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link)) return json(res, 410, { ok: false, error: "Shortlink sudah kedaluwarsa.", code: "EXPIRED" });
      if (link.paused) return json(res, 423, { ok: false, error: "Shortlink sedang dijeda.", code: "PAUSED" });
      await verifyRecaptcha(body.recaptchaToken, req);
      if (link.passwordHash && !validateAccessToken(body.accessToken, alias, link.passwordHash)) return json(res, 401, { ok: false, error: "Password perlu diverifikasi." });

      const click = buildClickData(req);
      const newClicks = Number(await redisCommand("INCR", `dimzlink:clicks:${alias}`));
      link.clicks = newClicks;
      link.lastClickAt = click.time;
      await recordEvent(link, click);
      await saveLink(link);

      return json(res, 200, {
        ok: true,
        clicks: newClicks,
        destination: link.destination,
        analytics: {
          tipe: click.type,
          perangkat: click.device,
          sistem: click.os,
          browser: click.browser,
          negara: click.country,
          bahasa: click.language,
          sumber: click.referrer
        }
      });
    }

    return json(res, 400, { ok: false, error: "Aksi tidak dikenali." });
  } catch (error) {
    console.error("DIMZ SHORTLINK API:", error);
    return json(res, error.status || 500, {
      ok: false,
      error: error.message || "Terjadi kesalahan pada server.",
      code: error.code || null
    });
  }
}

export default handleRequest;
