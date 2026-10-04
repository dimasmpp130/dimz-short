import crypto from "crypto";

const REDIS_URL =
  process.env.DIMZLINK_KV_REST_API_URL;

const REDIS_TOKEN =
  process.env.DIMZLINK_KV_REST_API_TOKEN;

const redisEnabled =
  Boolean(
    REDIS_URL &&
    REDIS_TOKEN
  );

function json(res, status, data) {

  res.statusCode = status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store"
  );

  res.end(
    JSON.stringify(data)
  );
}

function sha256(value) {

  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function randomToken(length = 24) {

  return crypto
    .randomBytes(length)
    .toString("hex");
}

function makePasswordHash(password) {

  return sha256(password);
}

function makeAccessToken(
  alias,
  passwordHash
) {

  const expires =
    Date.now() +
    10 * 60 * 1000;

  const secret =
    process.env.DIMZLINK_TOKEN_SECRET ||
    "dimzlink-default-secret";

  const signature =
    sha256(
      `${alias}.${passwordHash}.${expires}.${secret}`
    );

  return `${expires}.${signature}`;
}

function validateAccessToken(
  token,
  alias,
  passwordHash
) {

  if (!token) {
    return false;
  }

  const parts =
    String(token).split(".");

  if (parts.length !== 2) {
    return false;
  }

  const expires =
    Number(parts[0]);

  if (
    !Number.isFinite(expires) ||
    expires < Date.now()
  ) {
    return false;
  }

  const secret =
    process.env.DIMZLINK_TOKEN_SECRET ||
    "dimzlink-default-secret";

  const expected =
    sha256(
      `${alias}.${passwordHash}.${expires}.${secret}`
    );

  return parts[1] === expected;
}

function normalizeAlias(alias) {

  return String(alias || "")
    .trim()
    .replace(
      /[^A-Za-z0-9_-]/g,
      ""
    )
    .slice(0, 32);
}

function validAlias(alias) {

  return /^[A-Za-z0-9_-]{4,32}$/.test(
    alias
  );
}

function validUrl(value) {

  try {

    const url =
      new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );

  } catch {

    return false;
  }
}

function validateRules(rules) {

  if (
    !rules ||
    typeof rules !== "object" ||
    Array.isArray(rules)
  ) {
    return {};
  }

  const result = {};

  for (
    const [key, value]
    of Object.entries(rules)
  ) {

    if (
      typeof value !== "string" ||
      !validUrl(value)
    ) {
      throw new Error(
        `Redirect rule "${key}" memiliki URL tidak valid.`
      );
    }

    result[
      String(key).slice(0, 10)
    ] = value;
  }

  return result;
}

function isExpired(link) {

  return Boolean(
    link.expiresAt &&
    Date.parse(link.expiresAt) <= Date.now()
  );
}

function getKey(alias) {

  return `dimzlink:${alias}`;
}

function getClicksKey(alias) {

  return `dimzlink:clicks:${alias}`;
}

async function redisCommand(
  command,
  ...args
) {

  if (!redisEnabled) {

    throw new Error(
      "Redis belum dikonfigurasi. Pastikan DIMZLINK_KV_REST_API_URL dan DIMZLINK_KV_REST_API_TOKEN sudah dipasang di Vercel."
    );
  }

  const encodedArgs =
    args.map(
      (value) =>
        encodeURIComponent(
          String(value)
        )
    );

  const response =
    await fetch(
      `${REDIS_URL}/${command}/${encodedArgs.join("/")}`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${REDIS_TOKEN}`
        }
      }
    );

  if (!response.ok) {

    const text =
      await response.text()
        .catch(() => "");

    throw new Error(
      `Redis error ${response.status}${text ? `: ${text}` : ""}`
    );
  }

  const data =
    await response.json();

  return data.result;
}

async function getClickCount(
  alias,
  fallback = 0
) {

  const raw =
    await redisCommand(
      "GET",
      getClicksKey(alias)
    );

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {

    const initial =
      Math.max(
        0,
        Number(fallback || 0)
      );

    await redisCommand(
      "SET",
      getClicksKey(alias),
      initial
    );

    return initial;
  }

  const count =
    Number(raw);

  return Number.isFinite(count)
    ? count
    : 0;
}

async function incrementClickCount(
  alias
) {

  const result =
    await redisCommand(
      "INCR",
      getClicksKey(alias)
    );

  const count =
    Number(result);

  if (!Number.isFinite(count)) {

    throw new Error(
      "Gagal memperbarui jumlah klik."
    );
  }

  return count;
}

async function getLink(alias) {

  const raw =
    await redisCommand(
      "GET",
      getKey(alias)
    );

  if (!raw) {
    return null;
  }

  let link;

  try {

    link =
      JSON.parse(raw);

  } catch {

    throw new Error(
      "Data shortlink rusak atau tidak valid."
    );
  }

  link.clicks =
    await getClickCount(
      alias,
      link.clicks
    );

  return link;
}

async function saveLink(link) {

  const data = {
    ...link
  };

  delete data.clicks;

  await redisCommand(
    "SET",
    getKey(link.alias),
    JSON.stringify(data)
  );

  await getClickCount(
    link.alias,
    link.clicks || 0
  );
}

async function deleteStoredLink(
  alias
) {

  await redisCommand(
    "DEL",
    getKey(alias)
  );

  await redisCommand(
    "DEL",
    getClicksKey(alias)
  );
}

async function listStoredLinks() {

  let cursor = "0";

  const keys = [];

  do {

    const result =
      await redisCommand(
        "SCAN",
        cursor,
        "MATCH",
        "dimzlink:*",
        "COUNT",
        "100"
      );

    cursor =
      String(
        result?.[0] ?? "0"
      );

    const found =
      result?.[1] || [];

    for (const key of found) {

      if (
        !String(key)
          .startsWith(
            "dimzlink:clicks:"
          )
      ) {

        keys.push(key);
      }
    }

  } while (
    cursor !== "0"
  );

  const links = [];

  for (const key of keys) {

    const raw =
      await redisCommand(
        "GET",
        key
      );

    if (!raw) {
      continue;
    }

    try {

      const link =
        JSON.parse(raw);

      const alias =
        normalizeAlias(
          link.alias
        );

      if (!alias) {
        continue;
      }

      link.clicks =
        await getClickCount(
          alias,
          link.clicks
        );

      links.push(link);

    } catch {

    }
  }

  return links;
}

function publicLink(
  link,
  owner = false
) {

  const result = {

    alias:
      link.alias,

    destination:
      link.destination,

    expiresAt:
      link.expiresAt || null,

    createdAt:
      link.createdAt,

    clicks:
      Number(link.clicks || 0),

    lastClickAt:
      link.lastClickAt || null,

    passwordProtected:
      Boolean(
        link.passwordHash
      ),

    mobileUrl:
      link.mobileUrl || null,

    desktopUrl:
      link.desktopUrl || null,

    countryRules:
      link.countryRules || {},

    languageRules:
      link.languageRules || {}
  };

  if (owner) {

    result.recentClicks =
      Array.isArray(
        link.clickLog
      )
        ? link.clickLog.slice(-20)
        : [];
  }

  return result;
}

function detectDevice(userAgent) {

  const ua =
    String(
      userAgent || ""
    ).toLowerCase();

  if (
    /tablet|ipad/.test(ua)
  ) {

    return "tablet";
  }

  if (
    /mobile|android|iphone|ipod/.test(ua)
  ) {

    return "mobile";
  }

  return "desktop";
}

function detectBrowser(userAgent) {

  const ua =
    String(
      userAgent || ""
    );

  if (
    /Edg\//i.test(ua)
  ) {

    return "Edge";
  }

  if (
    /OPR\//i.test(ua)
  ) {

    return "Opera";
  }

  if (
    /Chrome\//i.test(ua)
  ) {

    return "Chrome";
  }

  if (
    /Firefox\//i.test(ua)
  ) {

    return "Firefox";
  }

  if (
    /Safari\//i.test(ua)
  ) {

    return "Safari";
  }

  return "Other";
}

function selectDestination(
  link,
  req
) {

  const headers =
    req.headers || {};

  const country =
    String(
      headers[
        "x-vercel-ip-country"
      ] || ""
    ).toUpperCase();

  const languageHeader =
    String(
      headers[
        "accept-language"
      ] || ""
    ).toLowerCase();

  const languages =
    languageHeader
      .split(",")
      .map(
        (item) =>
          item
            .trim()
            .split(";")[0]
      )
      .filter(Boolean);

  const device =
    detectDevice(
      headers[
        "user-agent"
      ]
    );

  if (
    country &&
    link.countryRules?.[country]
  ) {

    return (
      link.countryRules[country]
    );
  }

  for (
    const language
    of languages
  ) {

    const shortLanguage =
      language.split("-")[0];

    if (
      link.languageRules?.[language]
    ) {

      return (
        link.languageRules[language]
      );
    }

    if (
      link.languageRules?.[
        shortLanguage
      ]
    ) {

      return (
        link.languageRules[
          shortLanguage
        ]
      );
    }
  }

  if (
    device === "mobile" &&
    link.mobileUrl
  ) {

    return link.mobileUrl;
  }

  if (
    device === "desktop" &&
    link.desktopUrl
  ) {

    return link.desktopUrl;
  }

  return link.destination;
}

function getClientIp(req) {

  const forwarded =
    req.headers?.[
      "x-forwarded-for"
    ];

  if (forwarded) {

    return String(
      forwarded
    )
      .split(",")[0]
      .trim();
  }

  return (
    req.socket?.remoteAddress ||
    ""
  );
}

function buildClickData(req) {

  const userAgent =
    String(
      req.headers?.[
        "user-agent"
      ] || ""
    );

  const ip =
    getClientIp(req);

  const ipSecret =
    process.env.DIMZLINK_IP_SECRET ||
    "dimzlink-ip-secret";

  return {

    time:
      new Date().toISOString(),

    ipHash:
      sha256(
        `${ip}.${ipSecret}`
      ),

    device:
      detectDevice(
        userAgent
      ),

    browser:
      detectBrowser(
        userAgent
      ),

    country:
      String(
        req.headers?.[
          "x-vercel-ip-country"
        ] || ""
      ).toUpperCase() || null,

    language:
      String(
        req.headers?.[
          "accept-language"
        ] || ""
      ).slice(0, 100) || null,

    referrer:
      String(
        req.headers?.referer ||
        ""
      ).slice(0, 500) || null,

    userAgent:
      userAgent.slice(0, 500)
  };
}

async function parseBody(req) {

  if (
    req.body &&
    typeof req.body === "object"
  ) {

    return req.body;
  }

  return new Promise(
    (resolve, reject) => {

      let raw = "";

      req.on(
        "data",
        (chunk) => {

          raw += chunk;
        }
      );

      req.on(
        "end",
        () => {

          if (!raw) {

            resolve({});
            return;
          }

          try {

            resolve(
              JSON.parse(raw)
            );

          } catch {

            reject(
              new Error(
                "JSON body tidak valid."
              )
            );
          }
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

async function generateUniqueAlias() {

  for (
    let i = 0;
    i < 15;
    i++
  ) {

    const alias =
      crypto
        .randomBytes(4)
        .toString("base64url")
        .replace(
          /[^A-Za-z0-9_-]/g,
          ""
        )
        .slice(0, 6);

    if (
      !validAlias(alias)
    ) {

      continue;
    }

    const exists =
      await getLink(alias);

    if (!exists) {

      return alias;
    }
  }

  throw new Error(
    "Gagal membuat alias otomatis."
  );
}

async function verifyRecaptcha(token, req) {
  if (process.env.DIMZLINK_CAPTCHA_ENABLED !== "true") return true;
  const secret = process.env.DIMZLINK_RECAPTCHA_SECRET_KEY;
  if (!secret) throw new Error("reCAPTCHA secret belum dikonfigurasi.");
  if (!token) {
    const error = new Error("Verifikasi keamanan diperlukan.");
    error.status = 403;
    throw error;
  }
  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", String(token));
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwarded) form.set("remoteip", forwarded);
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    const error = new Error("Verifikasi reCAPTCHA gagal atau token kedaluwarsa. Silakan ulangi.");
    error.status = 403;
    throw error;
  }
  return true;
}

function verificationConfig() {
  return {
    verificationEnabled: process.env.DIMZLINK_CAPTCHA_ENABLED === "true",
    recaptchaSiteKey: process.env.DIMZLINK_RECAPTCHA_SITE_KEY || ""
  };
}

async function createLink(
  input
) {

  let alias =
    normalizeAlias(
      input.alias
    );

  if (!alias) {

    alias =
      await generateUniqueAlias();
  }

  if (
    !validAlias(alias)
  ) {

    throw new Error(
      "Alias tidak valid."
    );
  }

  const existing =
    await getLink(alias);

  if (existing) {

    const error =
      new Error(
        "Alias sudah digunakan."
      );

    error.status = 409;

    throw error;
  }

  if (
    !validUrl(
      input.destination
    )
  ) {

    throw new Error(
      "Destination URL tidak valid."
    );
  }

  const expiresAt =
    input.expiresAt
      ? new Date(
          input.expiresAt
        ).toISOString()
      : null;

  if (
    expiresAt &&
    Date.parse(expiresAt) <=
      Date.now()
  ) {

    throw new Error(
      "Expiration harus berada di masa depan."
    );
  }

  if (
    input.mobileUrl &&
    !validUrl(
      input.mobileUrl
    )
  ) {

    throw new Error(
      "Mobile URL tidak valid."
    );
  }

  if (
    input.desktopUrl &&
    !validUrl(
      input.desktopUrl
    )
  ) {

    throw new Error(
      "Desktop URL tidak valid."
    );
  }

  const countryRules =
    validateRules(
      input.countryRules || {}
    );

  const languageRules =
    validateRules(
      input.languageRules || {}
    );

  const link = {

    alias,

    destination:
      input.destination,

    expiresAt,

    createdAt:
      new Date().toISOString(),

    clicks: 0,

    lastClickAt:
      null,

    ownerKey:
      String(
        input.ownerKey || ""
      ),

    passwordHash:
      input.password
        ? makePasswordHash(
            input.password
          )
        : null,

    mobileUrl:
      input.mobileUrl || null,

    desktopUrl:
      input.desktopUrl || null,

    countryRules,

    languageRules,

    clickLog: []
  };

  if (!link.ownerKey) {

    link.ownerKey =
      randomToken(18);
  }

  await saveLink(link);

  return link;
}

async function updateExistingLink(
  input
) {

  const alias =
    normalizeAlias(
      input.alias
    );

  const link =
    await getLink(alias);

  if (!link) {

    const error =
      new Error(
        "Shortlink tidak ditemukan."
      );

    error.status = 404;

    throw error;
  }

  if (
    link.ownerKey !==
    input.ownerKey
  ) {

    const error =
      new Error(
        "Tidak memiliki akses."
      );

    error.status = 403;

    throw error;
  }

  if (
    !validUrl(
      input.destination
    )
  ) {

    throw new Error(
      "Destination URL tidak valid."
    );
  }

  const expiresAt =
    input.expiresAt
      ? new Date(
          input.expiresAt
        ).toISOString()
      : null;

  if (
    expiresAt &&
    Date.parse(expiresAt) <=
      Date.now()
  ) {

    throw new Error(
      "Expiration harus berada di masa depan."
    );
  }

  if (
    input.mobileUrl &&
    !validUrl(
      input.mobileUrl
    )
  ) {

    throw new Error(
      "Mobile URL tidak valid."
    );
  }

  if (
    input.desktopUrl &&
    !validUrl(
      input.desktopUrl
    )
  ) {

    throw new Error(
      "Desktop URL tidak valid."
    );
  }

  link.destination =
    input.destination;

  link.expiresAt =
    expiresAt;

  if (Object.prototype.hasOwnProperty.call(input, "mobileUrl")) {
    link.mobileUrl = input.mobileUrl || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "desktopUrl")) {
    link.desktopUrl = input.desktopUrl || null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "countryRules")) {
    link.countryRules = validateRules(input.countryRules || {});
  }

  if (Object.prototype.hasOwnProperty.call(input, "languageRules")) {
    link.languageRules = validateRules(input.languageRules || {});
  }

  if (
    input.removePassword === true
  ) {

    link.passwordHash = null;

  } else if (
    input.password &&
    String(
      input.password
    ).trim()
  ) {

    link.passwordHash =
      makePasswordHash(
        input.password
      );
  }

  await saveLink(link);

  return link;
}

async function handleRequest(
  req,
  res
) {

  if (!redisEnabled) {

    json(
      res,
      500,
      {
        ok: false,
        error:
          "DIMZLINK Redis belum dikonfigurasi. Tambahkan DIMZLINK_KV_REST_API_URL dan DIMZLINK_KV_REST_API_TOKEN di Vercel."
      }
    );

    return;
  }

  const method =
    String(
      req.method || "GET"
    ).toUpperCase();

  if (
    method === "OPTIONS"
  ) {

    res.statusCode = 204;
    res.end();

    return;
  }

  try {

    if (
      method === "GET"
    ) {

      const query =
        req.query || {};

      const action = String(query.action || "");

      if (action === "config") {
        json(res, 200, { ok: true, ...verificationConfig() });
        return;
      }

      if (
        action === "list"
      ) {

        const ownerKey =
          String(
            query.ownerKey || ""
          );

        if (!ownerKey) {

          json(
            res,
            400,
            {
              ok: false,
              error:
                "Owner key diperlukan."
            }
          );

          return;
        }

        const links =
          await listStoredLinks();

        const owned =
          links
            .filter(
              (link) =>
                link.ownerKey ===
                ownerKey
            )
            .map(
              (link) =>
                publicLink(
                  link,
                  true
                )
            )
            .sort(
              (a, b) =>
                Date.parse(
                  b.createdAt
                ) -
                Date.parse(
                  a.createdAt
                )
            );

        json(
          res,
          200,
          {
            ok: true,
            links: owned
          }
        );

        return;
      }

      const alias =
        normalizeAlias(
          query.alias
        );

      if (!alias) {

        json(
          res,
          400,
          {
            ok: false,
            error:
              "Alias diperlukan."
          }
        );

        return;
      }

      const link =
        await getLink(alias);

      if (!link) {

        json(
          res,
          404,
          {
            ok: false,
            error:
              "Shortlink tidak ditemukan."
          }
        );

        return;
      }

      if (
        isExpired(link)
      ) {

        json(
          res,
          410,
          {
            ok: false,
            error:
              "Shortlink sudah expired.",
            code:
              "EXPIRED"
          }
        );

        return;
      }

      json(
        res,
        200,
        {
          ok: true,
          link:
            publicLink(link)
        }
      );

      return;
    }

    if (
      method !== "POST"
    ) {

      json(
        res,
        405,
        {
          ok: false,
          error:
            "Method tidak didukung."
        }
      );

      return;
    }

    const body =
      await parseBody(req);

    const action =
      String(
        body.action || ""
      );

    if (action === "create") {
      await verifyRecaptcha(body.recaptchaToken, req);
      const link = await createLink(body);

      json(
        res,
        201,
        {
          ok: true,

          ownerKey:
            link.ownerKey,

          link:
            publicLink(link)
        }
      );

      return;
    }

    if (
      action === "update"
    ) {

      const link =
        await updateExistingLink(
          body
        );

      json(
        res,
        200,
        {
          ok: true,

          link:
            publicLink(link)
        }
      );

      return;
    }

    if (
      action === "delete"
    ) {

      const alias =
        normalizeAlias(
          body.alias
        );

      const link =
        await getLink(alias);

      if (!link) {

        json(
          res,
          404,
          {
            ok: false,
            error:
              "Shortlink tidak ditemukan."
          }
        );

        return;
      }

      if (
        link.ownerKey !==
        body.ownerKey
      ) {

        json(
          res,
          403,
          {
            ok: false,
            error:
              "Tidak memiliki akses."
          }
        );

        return;
      }

      await deleteStoredLink(
        alias
      );

      json(
        res,
        200,
        {
          ok: true
        }
      );

      return;
    }

    if (
      action === "verify"
    ) {

      const alias =
        normalizeAlias(
          body.alias
        );

      const link =
        await getLink(alias);

      if (!link) {

        json(
          res,
          404,
          {
            ok: false,
            error:
              "Shortlink tidak ditemukan."
          }
        );

        return;
      }

      if (
        isExpired(link)
      ) {

        json(
          res,
          410,
          {
            ok: false,
            error:
              "Shortlink sudah expired."
          }
        );

        return;
      }

      if (
        !link.passwordHash
      ) {

        json(
          res,
          200,
          {
            ok: true,
            accessToken: ""
          }
        );

        return;
      }

      const passwordHash =
        makePasswordHash(
          String(
            body.password || ""
          )
        );

      if (
        passwordHash !==
        link.passwordHash
      ) {

        json(
          res,
          401,
          {
            ok: false,
            error:
              "Password salah."
          }
        );

        return;
      }

      const accessToken =
        makeAccessToken(
          alias,
          link.passwordHash
        );

      json(
        res,
        200,
        {
          ok: true,
          accessToken
        }
      );

      return;
    }

    if (
      action === "track"
    ) {

      const alias =
        normalizeAlias(
          body.alias
        );

      const link =
        await getLink(alias);

      if (!link) {

        json(
          res,
          404,
          {
            ok: false,
            error:
              "Shortlink tidak ditemukan."
          }
        );

        return;
      }

      if (
        isExpired(link)
      ) {

        json(
          res,
          410,
          {
            ok: false,
            error:
              "Shortlink sudah expired.",
            code:
              "EXPIRED"
          }
        );

        return;
      }

      await verifyRecaptcha(body.recaptchaToken, req);

      if (link.passwordHash) {

        const validToken =
          validateAccessToken(
            body.accessToken,
            alias,
            link.passwordHash
          );

        if (!validToken) {

          json(
            res,
            401,
            {
              ok: false,
              error:
                "Password verification diperlukan."
            }
          );

          return;
        }
      }

      const newClicks =
        await incrementClickCount(
          alias
        );

      link.clicks =
        newClicks;

      link.lastClickAt =
        new Date().toISOString();

      const clickData =
        buildClickData(req);

      if (
        !Array.isArray(
          link.clickLog
        )
      ) {

        link.clickLog = [];
      }

      link.clickLog.push(
        clickData
      );

      if (
        link.clickLog.length >
        50
      ) {

        link.clickLog =
          link.clickLog.slice(-50);
      }

      await saveLink(link);

      const destination =
        selectDestination(
          link,
          req
        );

      json(
        res,
        200,
        {
          ok: true,

          clicks:
            newClicks,

          destination
        }
      );

      return;
    }

    json(
      res,
      400,
      {
        ok: false,
        error:
          "Action tidak dikenali."
      }
    );

  } catch (error) {

    console.error(
      "DIMZLINK API ERROR:",
      error
    );

    json(
      res,
      error.status || 500,
      {
        ok: false,

        error:
          error.message ||
          "Internal server error."
      }
    );
  }
}

export default handleRequest;
