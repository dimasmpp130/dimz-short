import crypto from "crypto";

const REDIS_URL = process.env.DIMZLINK_KV_REST_API_URL;
const REDIS_TOKEN = process.env.DIMZLINK_KV_REST_API_TOKEN;
const redisEnabled = Boolean(REDIS_URL && REDIS_TOKEN);
const TOKEN_SECRET = process.env.DIMZLINK_TOKEN_SECRET || "";
const IP_SECRET = process.env.DIMZLINK_IP_SECRET || "";
const CAPTCHA_ENABLED = process.env.DIMZLINK_CAPTCHA_ENABLED === "true";
const MAX_RECENT_EVENTS = 100;
const MAX_RULES = 12;
const RATE_LIMITS = Object.freeze({
  create: { limit: 20, window: 60 },
  update: { limit: 60, window: 60 },
  delete: { limit: 30, window: 60 },
  verify: { limit: 20, window: 60 },
  track: { limit: 300, window: 60 },
  list: { limit: 60, window: 60 },
  analytics: { limit: 30, window: 60 }
});

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  setSecurityHeaders(res);
  res.end(JSON.stringify(data));
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hmac(value, secret = TOKEN_SECRET) {
  return crypto.createHmac("sha256", secret || "dimzlink-dev-secret").update(String(value)).digest("hex");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function randomToken(length = 24) {
  return crypto.randomBytes(length).toString("hex");
}

function normalizeAlias(alias) {
  return String(alias || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
}

function validAlias(alias) {
  return /^[A-Za-z0-9_-]{4,32}$/.test(alias);
}

function validUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeDestination(value) {
  const url = new URL(String(value).trim());
  url.hash = url.hash || "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "m.youtube.com") {
    const video = url.searchParams.get("v");
    if (video) return `https://www.youtube.com/watch?v=${video}`;
    if (url.pathname.startsWith("/shorts/")) return `https://www.youtube.com/shorts/${url.pathname.split("/")[2] || ""}`;
  }
  url.searchParams.delete("si");
  url.searchParams.delete("utm_source");
  url.searchParams.delete("utm_medium");
  url.searchParams.delete("utm_campaign");
  url.searchParams.delete("utm_term");
  url.searchParams.delete("utm_content");
  return url.toString();
}

const BLOCKED_HOSTS = [
  "dimz-short.vercel.app",
  "link.dimz-wtf.web.id",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
  ...(process.env.DIMZLINK_BLOCKED_DOMAINS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean)
];

function isPrivateHostname(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.includes(h) || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const p = ipv4.slice(1).map(Number);
  return p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31);
}

function isBlockedUrl(value) {
  try {
    return isPrivateHostname(new URL(String(value)).hostname) || BLOCKED_HOSTS.some(d => new URL(String(value)).hostname.toLowerCase() === d || new URL(String(value)).hostname.toLowerCase().endsWith(`.${d}`));
  } catch {
    return true;
  }
}

function suspiciousUrl(value) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase();
    const text = `${host}${url.pathname}${url.search}`.toLowerCase();
    let score = 0;
    if (url.username || url.password) score += 3;
    if (host.includes("xn--")) score += 2;
    if (/login|verify|signin|account|wallet|password|credential|security-check|free-money|gift-card/.test(text)) score += 1;
    if ((url.port && ![80, 443].includes(Number(url.port)))) score += 1;
    if (text.length > 500) score += 1;
    if (/[<>"'`]/.test(String(value))) score += 3;
    return { score, suspicious: score >= 3 };
  } catch {
    return { score: 10, suspicious: true };
  }
}

function getKey(alias) { return `dimzlink:${alias}`; }
function getClicksKey(alias) { return `dimzlink:clicks:${alias}`; }
function getEventsKey(alias) { return `dimzlink:events:${alias}`; }
function getUniqueKey(alias) { return `dimzlink:unique:${alias}`; }
function getHourKey(alias) { return `dimzlink:hours:${alias}`; }
function getDayKey(alias) { return `dimzlink:days:${alias}`; }
function getHumanKey(alias) { return `dimzlink:human:${alias}`; }
function getBotKey(alias) { return `dimzlink:bot:${alias}`; }
function getDestinationKey(destination) { return `dimzlink:dest:${sha256(destination)}`; }
function getRecoveryKey(hash) { return `dimzlink:recovery:${hash}`; }
function getOwnerIndexKey(ownerKey) { return `dimzlink:owner:${sha256(ownerKey)}`; }
function getRateKey(ip, action) { return `dimzlink:rate:${action}:${sha256(ip)}`; }

async function redisCommand(command, ...args) {
  if (!redisEnabled) throw new Error("Redis belum dikonfigurasi. Pastikan DIMZLINK_KV_REST_API_URL dan DIMZLINK_KV_REST_API_TOKEN sudah dipasang di Vercel.");
  const encodedArgs = args.map(value => encodeURIComponent(String(value)));
  const response = await fetch(`${REDIS_URL}/${command}/${encodedArgs.join("/")}`, { method: "POST", headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  const data = await response.json();
  return data.result;
}

async function incrWithExpiry(key, windowSeconds) {
  const count = Number(await redisCommand("INCR", key));
  if (count === 1) await redisCommand("EXPIRE", key, windowSeconds);
  return count;
}

async function enforceRateLimit(req, action) {
  const rule = RATE_LIMITS[action];
  if (!rule) return;
  const ip = getClientIp(req) || "unknown";
  const count = await incrWithExpiry(getRateKey(ip, action), rule.window);
  if (count > rule.limit) {
    const error = new Error("Terlalu banyak request. Coba lagi sebentar.");
    error.status = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key)));
  return `scrypt$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function verifyPasswordHash(password, stored) {
  if (!stored) return false;
  if (String(stored).startsWith("scrypt$")) {
    const [, saltText, hashText] = String(stored).split("$");
    try {
      const salt = Buffer.from(saltText, "base64url");
      const expected = Buffer.from(hashText, "base64url");
      const derived = await new Promise((resolve, reject) => crypto.scrypt(String(password), salt, expected.length, { N: 16384, r: 8, p: 1 }, (err, key) => err ? reject(err) : resolve(key)));
      return safeEqual(derived, expected);
    } catch { return false; }
  }
  return safeEqual(sha256(password), stored.replace(/^sha256\$/, ""));
}

function makeAccessToken(alias, passwordHash) {
  const expires = Date.now() + 10 * 60 * 1000;
  return `${expires}.${hmac(`${alias}.${passwordHash}.${expires}`)}`;
}

function validateAccessToken(token, alias, passwordHash) {
  if (!token) return false;
  const [expiresText, signature] = String(token).split(".");
  const expires = Number(expiresText);
  if (!Number.isFinite(expires) || expires < Date.now() || !signature) return false;
  return safeEqual(signature, hmac(`${alias}.${passwordHash}.${expires}`));
}

function isExpired(link) { return Boolean(link.expiresAt && Date.parse(link.expiresAt) <= Date.now()); }

function validateRules(rules) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return {};
  const result = {};
  for (const [key, value] of Object.entries(rules).slice(0, MAX_RULES)) {
    if (typeof value !== "string" || !validUrl(value) || isBlockedUrl(value)) throw new Error(`Redirect rule "${key}" memiliki URL tidak valid.`);
    result[String(key).slice(0, 20)] = value;
  }
  return result;
}

async function getClickCount(alias, fallback = 0) {
  const raw = await redisCommand("GET", getClicksKey(alias));
  if (raw === null || raw === undefined || raw === "") {
    const initial = Math.max(0, Number(fallback || 0));
    await redisCommand("SET", getClicksKey(alias), initial);
    return initial;
  }
  const count = Number(raw);
  return Number.isFinite(count) ? count : 0;
}

async function incrementClickCount(alias) {
  const result = Number(await redisCommand("INCR", getClicksKey(alias)));
  if (!Number.isFinite(result)) throw new Error("Gagal memperbarui jumlah klik.");
  return result;
}

async function getLink(alias) {
  const raw = await redisCommand("GET", getKey(alias));
  if (!raw) return null;
  let link;
  try { link = JSON.parse(raw); } catch { throw new Error("Data shortlink rusak atau tidak valid."); }
  link.clicks = await getClickCount(alias, link.clicks);
  return link;
}

async function saveLink(link) {
  const data = { ...link };
  delete data.clicks;
  await redisCommand("SET", getKey(link.alias), JSON.stringify(data));
  await getClickCount(link.alias, link.clicks || 0);
}

async function deleteStoredLink(alias) {
  const link = await getLink(alias);
  await redisCommand("DEL", getKey(alias), getClicksKey(alias), getEventsKey(alias), getUniqueKey(alias), getHourKey(alias), getDayKey(alias), getHumanKey(alias), getBotKey(alias));
  if (link?.destination) await redisCommand("SREM", getDestinationKey(normalizeDestination(link.destination)), alias);
  if (link?.ownerKey) await redisCommand("SREM", getOwnerIndexKey(link.ownerKey), alias);
}

async function listOwnerLinks(ownerKey) {
  let aliases = await redisCommand("SMEMBERS", getOwnerIndexKey(ownerKey));
  aliases = Array.isArray(aliases) ? aliases : [];
  if (!aliases.length) {
    // One-time compatibility migration for links created before owner indexes.
    let cursor = "0";
    do {
      const result = await redisCommand("SCAN", cursor, "MATCH", "dimzlink:*", "COUNT", "100");
      cursor = String(result?.[0] ?? "0");
      for (const key of result?.[1] || []) {
        if (!/^dimzlink:[A-Za-z0-9_-]{4,32}$/.test(String(key))) continue;
        const raw = await redisCommand("GET", key);
        if (!raw) continue;
        try {
          const link = JSON.parse(raw);
          if (link.ownerKey === ownerKey) { aliases.push(link.alias); await redisCommand("SADD", getOwnerIndexKey(ownerKey), link.alias); }
        } catch {}
      }
    } while (cursor !== "0");
  }
  const links = [];
  for (const alias of aliases) {
    const link = await getLink(alias);
    if (link && link.ownerKey === ownerKey) links.push(link);
  }
  return links;
}

async function listStoredLinks() {
  let cursor = "0";
  const keys = [];
  do {
    const result = await redisCommand("SCAN", cursor, "MATCH", "dimzlink:*", "COUNT", "100");
    cursor = String(result?.[0] ?? "0");
    for (const key of result?.[1] || []) {
      if (String(key).startsWith("dimzlink:clicks:") || String(key).startsWith("dimzlink:events:") || String(key).startsWith("dimzlink:unique:") || String(key).startsWith("dimzlink:hours:") || String(key).startsWith("dimzlink:days:") || String(key).startsWith("dimzlink:rate:") || String(key).startsWith("dimzlink:dest:")) continue;
      keys.push(key);
    }
  } while (cursor !== "0");
  const links = [];
  for (const key of keys) {
    const raw = await redisCommand("GET", key);
    if (!raw) continue;
    try {
      const link = JSON.parse(raw);
      link.clicks = await getClickCount(link.alias, link.clicks);
      links.push(link);
    } catch {}
  }
  return links;
}

function publicLink(link, owner = false) {
  const result = {
    alias: link.alias,
    destination: link.destination,
    expiresAt: link.expiresAt || null,
    createdAt: link.createdAt,
    clicks: Number(link.clicks || 0),
    lastClickAt: link.lastClickAt || null,
    passwordProtected: Boolean(link.passwordHash),
    paused: Boolean(link.paused)
  };
  if (owner) {
    result.tags = Array.isArray(link.tags) ? link.tags.slice(0, 10) : [];
    result.folder = link.folder || "";
    result.mobileUrl = link.mobileUrl || null;
    result.desktopUrl = link.desktopUrl || null;
    result.countryRules = link.countryRules || {};
    result.languageRules = link.languageRules || {};
    result.abDestinations = Array.isArray(link.abDestinations) ? link.abDestinations : [];
    result.recentClicks = Array.isArray(link.clickLog) ? link.clickLog.slice(-20) : [];
  }
  return result;
}

function detectDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/bot|crawler|spider|headless|curl|wget|python-requests|axios/.test(ua)) return "bot";
  if (/tablet|ipad/.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function detectBrowser(userAgent) {
  const ua = String(userAgent || "");
  if (/bot|crawler|spider|headless|curl|wget|python-requests|axios/i.test(ua)) return "Bot";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Other";
}

function isLikelyBot(req) {
  const ua = String(req.headers?.["user-agent"] || "");
  return !ua || /bot|crawler|spider|headless|curl|wget|python-requests|axios|scrapy/i.test(ua);
}

function riskScore(req, destination = "") {
  const ua = String(req.headers?.["user-agent"] || "");
  let score = 0;
  if (!ua) score += 3;
  if (isLikelyBot(req)) score += 4;
  if (destination && suspiciousUrl(destination).score >= 3) score += 3;
  if (/headless|phantom|selenium|playwright|puppeteer/i.test(ua)) score += 4;
  if (String(req.headers?.["accept"] || "").length < 5) score += 1;
  return Math.min(score, 10);
}

function getClientIp(req) {
  return String(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
}

function buildClickData(req) {
  const userAgent = String(req.headers?.["user-agent"] || "");
  const ip = getClientIp(req);
  const secret = IP_SECRET || "dimzlink-ip-dev-secret";
  const language = String(req.headers?.["accept-language"] || "").split(",")[0].trim().slice(0, 35) || null;
  return {
    time: new Date().toISOString(),
    ipHash: sha256(`${ip}.${secret}`),
    device: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    os: /Windows/i.test(userAgent) ? "Windows" : /Android/i.test(userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" : /Mac OS/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : "Other",
    human: !isLikelyBot(req),
    country: String(req.headers?.["x-vercel-ip-country"] || "").toUpperCase() || null,
    language,
    referrer: String(req.headers?.referer || "").slice(0, 500) || null,
    userAgent: userAgent.slice(0, 500)
  };
}

function chooseAB(link) {
  const destinations = [link.destination, ...(Array.isArray(link.abDestinations) ? link.abDestinations : [])].filter(Boolean).slice(0, 3);
  if (destinations.length <= 1) return link.destination;
  return destinations[Math.floor(Math.random() * destinations.length)];
}

function selectDestination(link, req) {
  const headers = req.headers || {};
  const country = String(headers["x-vercel-ip-country"] || "").toUpperCase();
  const languages = String(headers["accept-language"] || "").toLowerCase().split(",").map(x => x.trim().split(";")[0]).filter(Boolean);
  const device = detectDevice(headers["user-agent"]);
  if (country && link.countryRules?.[country]) return link.countryRules[country];
  for (const language of languages) {
    const short = language.split("-")[0];
    if (link.languageRules?.[language]) return link.languageRules[language];
    if (link.languageRules?.[short]) return link.languageRules[short];
  }
  if (device === "mobile" && link.mobileUrl) return link.mobileUrl;
  if (device === "desktop" && link.desktopUrl) return link.desktopUrl;
  return chooseAB(link);
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 1000000) reject(new Error("Request terlalu besar.")); });
    req.on("end", () => { if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error("JSON body tidak valid.")); } });
    req.on("error", reject);
  });
}

async function generateUniqueAlias() {
  for (let i = 0; i < 15; i++) {
    const alias = crypto.randomBytes(4).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 6);
    if (validAlias(alias) && !(await getLink(alias))) return alias;
  }
  throw new Error("Gagal membuat alias otomatis.");
}

async function verifyRecaptcha(token, req, required = false) {
  if (!CAPTCHA_ENABLED || !required) return true;
  const secret = process.env.DIMZLINK_RECAPTCHA_SECRET_KEY;
  if (!secret) throw new Error("reCAPTCHA secret belum dikonfigurasi.");
  if (!token) { const e = new Error("Verifikasi keamanan diperlukan."); e.status = 403; throw e; }
  const form = new URLSearchParams({ secret, response: String(token) });
  const ip = getClientIp(req); if (ip) form.set("remoteip", ip);
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) { const e = new Error("Verifikasi reCAPTCHA gagal atau token kedaluwarsa. Silakan ulangi."); e.status = 403; throw e; }
  return true;
}

function verificationConfig(req) {
  return { verificationEnabled: CAPTCHA_ENABLED, adaptive: true, recaptchaSiteKey: process.env.DIMZLINK_RECAPTCHA_SITE_KEY || "", challengeThreshold: 4, riskScore: riskScore(req) };
}

async function findDuplicateAliases(destination) {
  const normalized = normalizeDestination(destination);
  const key = getDestinationKey(normalized);
  let aliases = await redisCommand("SMEMBERS", key);
  aliases = Array.isArray(aliases) ? aliases : [];
  if (aliases.length) return aliases.slice(0, 10);
  // Compatibility fallback for links created before the destination index existed.
  let cursor = "0";
  do {
    const result = await redisCommand("SCAN", cursor, "MATCH", "dimzlink:*", "COUNT", "100");
    cursor = String(result?.[0] ?? "0");
    for (const redisKey of result?.[1] || []) {
      if (!String(redisKey).match(/^dimzlink:[A-Za-z0-9_-]{4,32}$/)) continue;
      const raw = await redisCommand("GET", redisKey);
      if (!raw) continue;
      try {
        const link = JSON.parse(raw);
        if (normalizeDestination(link.destination) === normalized) {
          aliases.push(link.alias);
          await redisCommand("SADD", key, link.alias);
          if (aliases.length >= 10) return aliases;
        }
      } catch {}
    }
  } while (cursor !== "0");
  return aliases;
}

async function checkLinkHealth(link) {
  const target = link?.destination;
  if (!target || !validUrl(target) || isBlockedUrl(target)) return { status: "red", code: 0 };
  const started = Date.now();
  try {
    const response = await fetch(target, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(5000) });
    const code = response.status;
    return { status: code >= 200 && code < 400 ? "green" : code >= 400 && code < 500 ? "yellow" : "red", code, ms: Date.now() - started };
  } catch {
    return { status: "red", code: 0, ms: Date.now() - started };
  }
}

async function createLink(input, req) {
  let alias = normalizeAlias(input.alias);
  if (!alias) alias = await generateUniqueAlias();
  if (!validAlias(alias)) throw new Error("Alias tidak valid.");
  if (await getLink(alias)) { const e = new Error("Alias sudah digunakan."); e.status = 409; throw e; }
  if (!validUrl(input.destination)) throw new Error("Destination URL tidak valid.");
  if (isBlockedUrl(input.destination)) { const e = new Error("Domain tersebut tidak dapat digunakan sebagai tujuan shortlink."); e.status = 400; e.code = "BLOCKED_DESTINATION"; throw e; }
  const normalized = normalizeDestination(input.destination);
  const risk = suspiciousUrl(input.destination);
  if (risk.score >= 8) { const e = new Error("URL terdeteksi terlalu berisiko untuk dibuat sebagai shortlink."); e.status = 400; e.code = "SUSPICIOUS_DESTINATION"; throw e; }
  await verifyRecaptcha(input.recaptchaToken, req, riskScore(req, input.destination) >= 4);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error("Expiration harus berada di masa depan.");
  const mobileUrl = input.mobileUrl || null;
  const desktopUrl = input.desktopUrl || null;
  if (mobileUrl && (!validUrl(mobileUrl) || isBlockedUrl(mobileUrl))) throw new Error("Mobile URL tidak valid.");
  if (desktopUrl && (!validUrl(desktopUrl) || isBlockedUrl(desktopUrl))) throw new Error("Desktop URL tidak valid.");
  const countryRules = validateRules(input.countryRules || {});
  const languageRules = validateRules(input.languageRules || {});
  const abDestinations = Array.isArray(input.abDestinations) ? input.abDestinations.filter(x => typeof x === "string" && validUrl(x) && !isBlockedUrl(x)).slice(0, 2) : [];
  const ownerKey = String(input.ownerKey || randomToken(18));
  const recoveryCode = input.recoveryCode || randomToken(10);
  const recoveryHash = sha256(recoveryCode);
  if (input.password && !TOKEN_SECRET && process.env.VERCEL_ENV === "production") throw new Error("DIMZLINK_TOKEN_SECRET wajib dikonfigurasi untuk password-protected links.");
  const link = { alias, destination: input.destination, normalizedDestination: normalized, expiresAt, createdAt: new Date().toISOString(), clicks: 0, lastClickAt: null, ownerKey, recoveryHash, passwordHash: input.password ? await hashPassword(input.password) : null, mobileUrl, desktopUrl, countryRules, languageRules, abDestinations, folder: String(input.folder || "").slice(0, 40), paused: false, tags: Array.isArray(input.tags) ? input.tags.slice(0, 10).map(x => String(x).slice(0, 30)) : [], clickLog: [] };
  await saveLink(link);
  await redisCommand("SADD", getDestinationKey(normalized), alias);
  await redisCommand("SET", getRecoveryKey(recoveryHash), ownerKey);
  await redisCommand("SADD", getOwnerIndexKey(ownerKey), alias);
  return { ...link, recoveryCode };
}

async function updateExistingLink(input) {
  const alias = normalizeAlias(input.alias);
  const link = await getLink(alias);
  if (!link) { const e = new Error("Shortlink tidak ditemukan."); e.status = 404; throw e; }
  if (link.ownerKey !== input.ownerKey) { const e = new Error("Tidak memiliki akses."); e.status = 403; throw e; }
  if (!validUrl(input.destination) || isBlockedUrl(input.destination)) throw new Error("Destination URL tidak valid atau diblokir.");
  const oldNormalized = link.normalizedDestination || normalizeDestination(link.destination);
  const expiresAt = input.expiresAt ? new Date(input.expiresAt).toISOString() : null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) throw new Error("Expiration harus berada di masa depan.");
  link.destination = input.destination;
  link.normalizedDestination = normalizeDestination(input.destination);
  link.expiresAt = expiresAt;
  if (input.password && !TOKEN_SECRET && process.env.VERCEL_ENV === "production") throw new Error("DIMZLINK_TOKEN_SECRET wajib dikonfigurasi untuk password-protected links.");
  if (Object.hasOwn(input, "mobileUrl")) link.mobileUrl = input.mobileUrl || null;
  if (Object.hasOwn(input, "desktopUrl")) link.desktopUrl = input.desktopUrl || null;
  if (Object.hasOwn(input, "countryRules")) link.countryRules = validateRules(input.countryRules || {});
  if (Object.hasOwn(input, "languageRules")) link.languageRules = validateRules(input.languageRules || {});
  if (Object.hasOwn(input, "abDestinations")) link.abDestinations = Array.isArray(input.abDestinations) ? input.abDestinations.slice(0, 2) : [];
  if (Object.hasOwn(input, "paused")) link.paused = Boolean(input.paused);
  if (Object.hasOwn(input, "tags")) link.tags = Array.isArray(input.tags) ? input.tags.slice(0, 10).map(x => String(x).slice(0, 30)) : [];
  if (Object.hasOwn(input, "folder")) link.folder = String(input.folder || "").slice(0, 40);
  if (input.removePassword === true) link.passwordHash = null;
  else if (input.password && String(input.password).trim()) link.passwordHash = await hashPassword(input.password);
  await saveLink(link);
  await redisCommand("SADD", getOwnerIndexKey(link.ownerKey), alias);
  await redisCommand("SREM", getDestinationKey(oldNormalized), alias);
  await redisCommand("SADD", getDestinationKey(link.normalizedDestination), alias);
  return link;
}

async function analyticsFor(alias) {
  const raw = await redisCommand("LRANGE", getEventsKey(alias), 0, MAX_RECENT_EVENTS - 1);
  const events = (raw || []).map(x => { try { return typeof x === "string" ? JSON.parse(x) : x; } catch { return null; } }).filter(Boolean);
  const total = Number(await getClickCount(alias, 0));
  const unique = Number(await redisCommand("SCARD", getUniqueKey(alias)) || 0);
  const human = Number(await redisCommand("GET", getHumanKey(alias)) || 0);
  const bot = Number(await redisCommand("GET", getBotKey(alias)) || 0);
  const hourRaw = await redisCommand("HGETALL", getHourKey(alias));
  const dayRaw = await redisCommand("HGETALL", getDayKey(alias));
  const hashToObject = (raw) => { const out = {}; if (Array.isArray(raw)) for (let i = 0; i < raw.length; i += 2) out[raw[i]] = Number(raw[i + 1] || 0); return out; };
  const aggregate = (field) => events.reduce((m, e) => { const k = e[field] || "Unknown"; m[k] = (m[k] || 0) + 1; return m; }, {});
  return { totalClicks: total, uniqueVisitors: unique, human, bot, byHour: hashToObject(hourRaw), byDay: hashToObject(dayRaw), byCountry: aggregate("country"), byDevice: aggregate("device"), byOS: aggregate("os"), byBrowser: aggregate("browser"), byLanguage: aggregate("language"), byReferrer: aggregate("referrer"), recent: events.slice(0, 50) };
}

async function recordAnalytics(alias, req) {
  const event = buildClickData(req);
  const jsonEvent = JSON.stringify(event);
  await redisCommand("LPUSH", getEventsKey(alias), jsonEvent);
  await redisCommand("LTRIM", getEventsKey(alias), 0, MAX_RECENT_EVENTS - 1);
  if (event.ipHash) await redisCommand("SADD", getUniqueKey(alias), event.ipHash);
  await redisCommand("INCR", event.human ? getHumanKey(alias) : getBotKey(alias));
  const d = new Date();
  const hour = d.toISOString().slice(0, 13);
  const day = d.toISOString().slice(0, 10);
  await redisCommand("HINCRBY", getHourKey(alias), hour, 1);
  await redisCommand("HINCRBY", getDayKey(alias), day, 1);
  return event;
}

async function handleRequest(req, res) {
  setSecurityHeaders(res);
  if (!redisEnabled) return json(res, 500, { ok: false, error: "DIMZLINK Redis belum dikonfigurasi." });
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") { res.statusCode = 204; res.end(); return; }
  try {
    if (method === "GET") {
      const query = req.query || {};
      const action = String(query.action || "");
      if (action === "config") return json(res, 200, { ok: true, ...verificationConfig(req) });
      if (action === "security") return json(res, 200, { ok: true, ...verificationConfig(req), challengeRequired: CAPTCHA_ENABLED && riskScore(req) >= 4 });
      if (action === "checkDestination") {
        await enforceRateLimit(req, "create");
        const destination = String(query.destination || "");
        if (!validUrl(destination) || isBlockedUrl(destination)) return json(res, 400, { ok: false, error: "Destination URL tidak valid atau diblokir." });
        const aliases = await findDuplicateAliases(destination);
        return json(res, 200, { ok: true, duplicate: aliases.length > 0, aliases });
      }
      if (action === "recover") {
        const code = String(query.recoveryCode || "").trim();
        if (code.length < 8) return json(res, 400, { ok: false, error: "Recovery code tidak valid." });
        const ownerKey = await redisCommand("GET", getRecoveryKey(sha256(code)));
        if (!ownerKey) return json(res, 404, { ok: false, error: "Recovery code tidak ditemukan." });
        return json(res, 200, { ok: true, ownerKey });
      }
      if (action === "list") {
        await enforceRateLimit(req, "list");
        const ownerKey = String(query.ownerKey || "");
        if (!ownerKey) return json(res, 400, { ok: false, error: "Owner key diperlukan." });
        const owned = (await listOwnerLinks(ownerKey)).map(l => publicLink(l, true)).sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt));
        return json(res, 200, { ok: true, links: owned });
      }
      if (action === "health") {
        await enforceRateLimit(req, "analytics");
        const alias = normalizeAlias(query.alias); const ownerKey = String(query.ownerKey || ""); const link = await getLink(alias);
        if (!link || link.ownerKey !== ownerKey) return json(res, 403, { ok: false, error: "Tidak memiliki akses." });
        return json(res, 200, { ok: true, health: await checkLinkHealth(link) });
      }
      if (action === "analytics") {
        await enforceRateLimit(req, "analytics");
        const alias = normalizeAlias(query.alias); const ownerKey = String(query.ownerKey || ""); const link = await getLink(alias);
        if (!link || link.ownerKey !== ownerKey) return json(res, 403, { ok: false, error: "Tidak memiliki akses." });
        return json(res, 200, { ok: true, analytics: await analyticsFor(alias) });
      }
      const alias = normalizeAlias(query.alias);
      if (!alias) return json(res, 400, { ok: false, error: "Alias diperlukan." });
      const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link)) return json(res, 410, { ok: false, error: "Shortlink sudah expired.", code: "EXPIRED" });
      return json(res, 200, { ok: true, link: publicLink(link) });
    }
    if (method !== "POST") return json(res, 405, { ok: false, error: "Method tidak didukung." });
    const body = await parseBody(req); const action = String(body.action || "");
    if (RATE_LIMITS[action]) await enforceRateLimit(req, action);
    if (action === "create") {
      const link = await createLink(body, req);
      return json(res, 201, { ok: true, ownerKey: link.ownerKey, recoveryCode: link.recoveryCode, link: publicLink(link), duplicate: false });
    }
    if (action === "update") return json(res, 200, { ok: true, link: publicLink(await updateExistingLink(body)) });
    if (action === "pause" || action === "resume") {
      const alias = normalizeAlias(body.alias); const link = await getLink(alias);
      if (!link || link.ownerKey !== body.ownerKey) return json(res, 403, { ok: false, error: "Tidak memiliki akses." });
      link.paused = action === "pause"; await saveLink(link); return json(res, 200, { ok: true, link: publicLink(link) });
    }
    if (action === "delete") {
      const alias = normalizeAlias(body.alias); const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (link.ownerKey !== body.ownerKey) return json(res, 403, { ok: false, error: "Tidak memiliki akses." });
      await deleteStoredLink(alias); return json(res, 200, { ok: true });
    }
    if (action === "verify") {
      const alias = normalizeAlias(body.alias); const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link) || link.paused) return json(res, 410, { ok: false, error: link.paused ? "Shortlink sedang dijeda." : "Shortlink sudah expired." });
      if (!link.passwordHash) return json(res, 200, { ok: true, accessToken: "" });
      if (!(await verifyPasswordHash(String(body.password || ""), link.passwordHash))) return json(res, 401, { ok: false, error: "Password salah." });
      return json(res, 200, { ok: true, accessToken: makeAccessToken(alias, link.passwordHash) });
    }
    if (action === "track") {
      const alias = normalizeAlias(body.alias); const link = await getLink(alias);
      if (!link) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      if (isExpired(link)) return json(res, 410, { ok: false, error: "Shortlink sudah expired.", code: "EXPIRED" });
      if (link.paused) return json(res, 423, { ok: false, error: "Shortlink sedang dijeda.", code: "PAUSED" });
      await verifyRecaptcha(body.recaptchaToken, req, CAPTCHA_ENABLED && riskScore(req) >= 4);
      if (link.passwordHash && !validateAccessToken(body.accessToken, alias, link.passwordHash)) return json(res, 401, { ok: false, error: "Password verification diperlukan." });
      const event = await recordAnalytics(alias, req);
      const newClicks = await incrementClickCount(alias);
      link.clicks = newClicks; link.lastClickAt = event.time;
      link.clickLog = Array.isArray(link.clickLog) ? [...link.clickLog, event].slice(-50) : [event];
      await saveLink(link);
      return json(res, 200, { ok: true, destination: selectDestination(link, req), click: event, clicks: newClicks });
    }
    return json(res, 400, { ok: false, error: "Action tidak dikenal." });
  } catch (error) {
    console.error("DIMZLINK API error:", error);
    const status = Number(error?.status) || 500;
    return json(res, status, { ok: false, error: status >= 500 ? "Terjadi kesalahan server." : (error.message || "Request gagal."), code: error.code || undefined });
  }
}

export default async function handler(req, res) {
  return handleRequest(req, res);
}
