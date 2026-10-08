import crypto from "crypto";

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

export function getClientIp(req) {
  const forwarded = String(req.headers?.["x-vercel-forwarded-for"] || req.headers?.["x-real-ip"] || req.headers?.["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim() || String(req.socket?.remoteAddress || "unknown");
}

export function assertSameOrigin(req) {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return;
  const host = String(req.headers?.host || "").trim();
  const proto = String(req.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  if (!host) return;
  let expected;
  try { expected = new URL(`${proto}://${host}`).origin; } catch { expected = ""; }
  if (expected && origin !== expected) {
    const error = new Error("Permintaan lintas situs tidak diizinkan.");
    error.status = 403;
    error.code = "CSRF_ORIGIN";
    throw error;
  }
}

export function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://cdnjs.cloudflare.com https://www.highrevenueformat.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: blob: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' https:; frame-src 'self' https://www.google.com https://www.gstatic.com https://*.highrevenueformat.com; form-action 'self';");
}

export async function parseBody(req) {
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
