import crypto from "crypto";

const REDIS_URL = process.env.DIMZLINK_KV_REST_API_URL;
const REDIS_TOKEN = process.env.DIMZLINK_KV_REST_API_TOKEN;
const ADMIN_PASSWORD = process.env.DIMZLINK_ADMIN_PASSWORD || "";
const ADMIN_PASSWORD_HASH = process.env.DIMZLINK_ADMIN_PASSWORD_HASH || "";
const ADMIN_SECRET = process.env.DIMZLINK_ADMIN_SECRET || "";
const SESSION_MAX_AGE = 8 * 60 * 60 * 1000;

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';");
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  setSecurityHeaders(res);
  res.end(JSON.stringify(data));
}

function redisReady() { return Boolean(REDIS_URL && REDIS_TOKEN); }

function sha256(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifyScrypt(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  try {
    const [, n, r, p, saltHex, hashHex] = parts;
    const derived = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), 64, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024
    });
    return safeEqual(derived.toString("hex"), hashHex);
  } catch { return false; }
}

function verifyAdminPassword(password) {
  if (ADMIN_PASSWORD_HASH) {
    return verifyScrypt(password, ADMIN_PASSWORD_HASH) || safeEqual(sha256(password), ADMIN_PASSWORD_HASH);
  }
  return ADMIN_PASSWORD && safeEqual(password, ADMIN_PASSWORD);
}

function redisCommand(command, ...args) {
  const encoded = args.map((value) => encodeURIComponent(String(value)));
  return fetch(`${REDIS_URL}/${command}/${encoded.join("/")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Redis error ${response.status}`);
    const data = await response.json();
    return data.result;
  });
}

function parseCookies(req) {
  const cookie = String(req.headers?.cookie || "");
  return Object.fromEntries(cookie.split(";").map((part) => {
    const i = part.indexOf("=");
    return i > -1 ? [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())] : null;
  }).filter(Boolean));
}

function makeSessionToken() {
  if (!ADMIN_SECRET) throw new Error("DIMZLINK_ADMIN_SECRET belum dikonfigurasi.");
  const expires = Date.now() + SESSION_MAX_AGE;
  const nonce = crypto.randomBytes(24).toString("hex");
  const sig = sha256(`${expires}.${nonce}.${ADMIN_SECRET}`);
  return `${expires}.${nonce}.${sig}`;
}

function validateSession(token) {
  if (!token || !ADMIN_SECRET) return false;
  const [expires, nonce, sig] = String(token).split(".");
  if (!expires || !nonce || !sig || Number(expires) <= Date.now()) return false;
  return safeEqual(sig, sha256(`${expires}.${nonce}.${ADMIN_SECRET}`));
}

function isAuthenticated(req) {
  return validateSession(parseCookies(req).dimzlink_admin);
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", `dimzlink_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_MAX_AGE / 1000)}`);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "dimzlink_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 200000) reject(new Error("Request terlalu besar.")); });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Format permintaan tidak valid.")); }
    });
    req.on("error", reject);
  });
}

function validUrl(value) {
  try { const u = new URL(String(value)); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

function hashLinkPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function getAllLinks({ withEvents = false } = {}) {
  let aliases = await redisCommand("SMEMBERS", "dimzlink:index");
  aliases = Array.isArray(aliases) ? [...new Set(aliases.map(String))] : [];

  if (!aliases.length) {
    let cursor = "0";
    do {
      const result = await redisCommand("SCAN", cursor, "MATCH", "dimzlink:*", "COUNT", "100");
      cursor = String(result?.[0] ?? "0");
      for (const key of result?.[1] || []) {
        const value = String(key);
        if (!value.startsWith("dimzlink:clicks:") && !value.startsWith("dimzlink:events:") && value !== "dimzlink:index") aliases.push(value.replace(/^dimzlink:/, ""));
      }
    } while (cursor !== "0");
    aliases = [...new Set(aliases)];
    if (aliases.length) {
      // Migration fallback only; normal dashboard reads the index directly.
      await Promise.all(aliases.map((alias) => redisCommand("SADD", "dimzlink:index", alias)));
    }
  }

  if (!aliases.length) return [];

  // MGET mengubah pola 2-3 request Redis per link menjadi hanya beberapa request
  // untuk seluruh daftar, sehingga dashboard tetap cepat walaupun link banyak.
  const chunks = [];
  for (let i = 0; i < aliases.length; i += 50) chunks.push(aliases.slice(i, i + 50));
  const batches = await Promise.all(chunks.map(async (chunk) => {
    const [rawLinks, rawClicks] = await Promise.all([
      redisCommand("MGET", ...chunk.map((alias) => `dimzlink:${alias}`)),
      redisCommand("MGET", ...chunk.map((alias) => `dimzlink:clicks:${alias}`))
    ]);
    return { chunk, rawLinks: Array.isArray(rawLinks) ? rawLinks : [], rawClicks: Array.isArray(rawClicks) ? rawClicks : [] };
  }));

  const links = [];
  const linkValues = [];
  const clickValues = [];
  for (const batch of batches) {
    linkValues.push(...batch.rawLinks);
    clickValues.push(...batch.rawClicks);
  }

  for (let i = 0; i < aliases.length; i++) {
    try {
      const raw = linkValues[i];
      if (!raw) continue;
      const link = JSON.parse(raw);
      link.clicks = Number(clickValues[i] || link.clicks || 0);
      if (withEvents) {
        const eventsRaw = await redisCommand("LRANGE", `dimzlink:events:${link.alias}`, 0, 499);
        link.events = (Array.isArray(eventsRaw) ? eventsRaw : []).map((x) => {
          try { return JSON.parse(x); } catch { return null; }
        }).filter(Boolean);
      }
      links.push(link);
    } catch {}
  }
  return links;
}

function publicAdminLink(link) {
  return {
    alias: link.alias,
    destination: link.destination,
    createdAt: link.createdAt || null,
    expiresAt: link.expiresAt || null,
    clicks: Number(link.clicks || 0),
    lastClickAt: link.lastClickAt || null,
    paused: Boolean(link.paused),
    passwordProtected: Boolean(link.passwordHash),
    recentClicks: Array.isArray(link.events) ? link.events.slice(0, 200) : []
  };
}

function buildStats(links) {
  const stats = {
    totalLinks: links.length,
    totalClicks: 0,
    uniqueVisitors: new Set(),
    human: 0,
    bot: 0,
    countries: {}, devices: {}, operatingSystems: {}, browsers: {}, languages: {}, referrers: {},
    clicksByHour: {}, clicksByDay: {}
  };

  const bump = (obj, key) => { const k = key || "Tidak diketahui"; obj[k] = (obj[k] || 0) + 1; };

  for (const link of links) {
    stats.totalClicks += Number(link.clicks || 0);
    for (const e of Array.isArray(link.events) ? link.events : []) {
      if (e.visitor) stats.uniqueVisitors.add(e.visitor);
      e.type === "bot" ? stats.bot++ : stats.human++;
      bump(stats.countries, e.country);
      bump(stats.devices, e.device);
      bump(stats.operatingSystems, e.os);
      bump(stats.browsers, e.browser);
      bump(stats.languages, e.language);
      bump(stats.referrers, e.referrer);
      if (e.time) {
        const d = new Date(e.time);
        if (!Number.isNaN(d.getTime())) {
          bump(stats.clicksByHour, String(d.getUTCHours()).padStart(2, "0") + ":00");
          bump(stats.clicksByDay, d.toISOString().slice(0, 10));
        }
      }
    }
  }
  stats.uniqueVisitors = stats.uniqueVisitors.size;
  return stats;
}

async function updateLink(body) {
  const alias = String(body.alias || "").trim();
  const raw = await redisCommand("GET", `dimzlink:${alias}`);
  if (!raw) { const e = new Error("Shortlink tidak ditemukan."); e.status = 404; throw e; }
  const link = JSON.parse(raw);
  const destination = String(body.destination || "").trim();
  if (!validUrl(destination)) throw new Error("URL tujuan tidak valid.");
  link.destination = destination;
  if (Object.prototype.hasOwnProperty.call(body, "expiresAt")) {
    if (!body.expiresAt) link.expiresAt = null;
    else {
      const date = new Date(body.expiresAt);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error("Tanggal kedaluwarsa tidak valid.");
      link.expiresAt = date.toISOString();
    }
  }
  if (String(body.password || "").trim()) link.passwordHash = hashLinkPassword(body.password);
  if (body.removePassword === true) link.passwordHash = null;
  await redisCommand("SET", `dimzlink:${alias}`, JSON.stringify(link));
  return link;
}

async function deleteLink(alias) {
  await redisCommand("DEL", `dimzlink:${alias}`);
  await redisCommand("DEL", `dimzlink:clicks:${alias}`);
  await redisCommand("DEL", `dimzlink:events:${alias}`);
  await redisCommand("SREM", "dimzlink:index", alias);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function getLinkAnalytics(alias) {
  const raw = await redisCommand("GET", `dimzlink:${alias}`);
  if (!raw) { const e = new Error("Shortlink tidak ditemukan."); e.status = 404; throw e; }
  const link = JSON.parse(raw);
  const eventsRaw = await redisCommand("LRANGE", `dimzlink:events:${alias}`, 0, 499);
  const events = (Array.isArray(eventsRaw) ? eventsRaw : []).map((x) => {
    try { return JSON.parse(x); } catch { return null; }
  }).filter(Boolean);
  return { alias: link.alias, clicks: Number(link.clicks || 0), events };
}

async function exportCsv() {
  const links = await getAllLinks();
  const rows = ["Waktu,Alias,Tipe,Negara,Perangkat,OS,Browser,Bahasa,Referrer"];
  for (const link of links) {
    for (const e of link.events || []) {
      rows.push([
        e.time, link.alias, e.type, e.country, e.device, e.os, e.browser, e.language, e.referrer
      ].map(csvEscape).join(","));
    }
  }
  return rows.join("\n");
}

export default async function handler(req, res) {
  if (!redisReady()) return json(res, 500, { ok: false, error: "Redis belum dikonfigurasi." });
  setSecurityHeaders(res);
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === "OPTIONS") { res.statusCode = 204; return res.end(); }

    if (method === "GET") {
      if (!isAuthenticated(req)) return json(res, 401, { ok: false, authenticated: false, error: "Admin belum login." });
      const query = req.query || {};
      if (String(query.action || "") === "export") {
        const csv = await exportCsv();
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="dimz-analytics.csv"');
        setSecurityHeaders(res);
        return res.end(csv);
      }
      if (String(query.action || "") === "analytics") {
        const alias = String(query.alias || "").trim();
        if (!alias) return json(res, 400, { ok: false, error: "Alias diperlukan." });
        return json(res, 200, { ok: true, analytics: await getLinkAnalytics(alias) });
      }

      if (String(query.action || "") === "stats") {
        const links = await getAllLinks({ withEvents: true });
        return json(res, 200, { ok: true, stats: buildStats(links) });
      }

      const links = await getAllLinks();
      const basicStats = {
        totalLinks: links.length,
        totalClicks: links.reduce((sum, link) => sum + Number(link.clicks || 0), 0),
        uniqueVisitors: 0, human: 0, bot: 0,
        countries: {}, devices: {}, browsers: {}, languages: {}
      };
      return json(res, 200, {
        ok: true, authenticated: true,
        links: links.map(publicAdminLink).sort((a,b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)),
        stats: basicStats,
        statsPending: true
      });
    }

    if (method !== "POST") return json(res, 405, { ok: false, error: "Metode tidak didukung." });
    const body = await parseBody(req);
    const action = String(body.action || "");

    if (action === "login") {
      if (!verifyAdminPassword(String(body.password || ""))) return json(res, 401, { ok: false, error: "Password admin salah." });
      setSessionCookie(res, makeSessionToken());
      return json(res, 200, { ok: true, authenticated: true });
    }

    if (action === "logout") {
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }

    if (!isAuthenticated(req)) return json(res, 401, { ok: false, error: "Sesi admin sudah berakhir." });

    if (action === "update") return json(res, 200, { ok: true, link: publicAdminLink(await updateLink(body)) });

    if (action === "state") {
      const alias = String(body.alias || "");
      const raw = await redisCommand("GET", `dimzlink:${alias}`);
      if (!raw) return json(res, 404, { ok: false, error: "Shortlink tidak ditemukan." });
      const link = JSON.parse(raw); link.paused = Boolean(body.paused);
      await redisCommand("SET", `dimzlink:${alias}`, JSON.stringify(link));
      return json(res, 200, { ok: true, link: publicAdminLink(link) });
    }

    if (action === "delete") {
      await deleteLink(String(body.alias || ""));
      return json(res, 200, { ok: true });
    }

    if (action === "export") {
      const csv = await exportCsv();
      setSecurityHeaders(res);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="dimz-analytics.csv"');
      return res.end(csv);
    }

    return json(res, 400, { ok: false, error: "Aksi tidak dikenali." });
  } catch (error) {
    console.error("DIMZ ADMIN API:", error);
    return json(res, error.status || 500, { ok: false, error: error.message || "Terjadi kesalahan server." });
  }
}
