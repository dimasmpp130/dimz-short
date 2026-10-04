import crypto from "crypto";

/*
========================================================
 DIMZLINK ADMIN API
========================================================

Environment Variables:

DIMZLINK_KV_REST_API_URL
DIMZLINK_KV_REST_API_TOKEN

DIMZLINK_ADMIN_PASSWORD
DIMZLINK_ADMIN_SECRET

========================================================
*/

const REDIS_URL =
  process.env.DIMZLINK_KV_REST_API_URL;

const REDIS_TOKEN =
  process.env.DIMZLINK_KV_REST_API_TOKEN;

const ADMIN_PASSWORD =
  process.env.DIMZLINK_ADMIN_PASSWORD;

const ADMIN_SECRET =
  process.env.DIMZLINK_ADMIN_SECRET;

const SESSION_MAX_AGE =
  8 * 60 * 60 * 1000;


/*
========================================================
 BASIC RESPONSE
========================================================
*/

function json(
  res,
  status,
  data
) {

  res.statusCode =
    status;

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  res.end(
    JSON.stringify(data)
  );
}


/*
========================================================
 REDIS CHECK
========================================================
*/

function redisReady() {

  return Boolean(
    REDIS_URL &&
    REDIS_TOKEN
  );
}


/*
========================================================
 SHA256
========================================================
*/

function sha256(
  value
) {

  return crypto
    .createHash("sha256")
    .update(
      String(value)
    )
    .digest("hex");
}


/*
========================================================
 CONSTANT-TIME COMPARE
========================================================
*/

function safeEqual(
  a,
  b
) {

  const left =
    Buffer.from(
      String(a)
    );

  const right =
    Buffer.from(
      String(b)
    );

  if (
    left.length !==
    right.length
  ) {

    return false;
  }

  return crypto.timingSafeEqual(
    left,
    right
  );
}


/*
========================================================
 REDIS COMMAND
========================================================
*/

async function redisCommand(
  command,
  ...args
) {

  if (!redisReady()) {

    throw new Error(
      "Redis admin belum dikonfigurasi."
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
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      `Redis error ${response.status}${text ? `: ${text}` : ""}`
    );
  }

  const data =
    await response.json();

  return data.result;
}


/*
========================================================
 SESSION
========================================================
*/

function makeSessionToken() {

  const expires =
    Date.now() +
    SESSION_MAX_AGE;

  const nonce =
    crypto
      .randomBytes(32)
      .toString("hex");

  const signature =
    sha256(
      `${expires}.${nonce}.${ADMIN_SECRET}`
    );

  return `${expires}.${nonce}.${signature}`;
}


function validateSession(
  token
) {

  if (
    !token ||
    !ADMIN_SECRET
  ) {

    return false;
  }

  const parts =
    String(token).split(".");

  if (
    parts.length !== 3
  ) {

    return false;
  }

  const expires =
    Number(parts[0]);

  const nonce =
    parts[1];

  const signature =
    parts[2];

  if (
    !Number.isFinite(expires)
  ) {

    return false;
  }

  if (
    expires <= Date.now()
  ) {

    return false;
  }

  const expected =
    sha256(
      `${expires}.${nonce}.${ADMIN_SECRET}`
    );

  return safeEqual(
    signature,
    expected
  );
}


/*
========================================================
 COOKIE
========================================================
*/

function getCookie(
  req,
  name
) {

  const cookie =
    req.headers?.cookie ||
    "";

  const parts =
    cookie.split(";");

  for (
    const part of parts
  ) {

    const index =
      part.indexOf("=");

    if (
      index === -1
    ) {

      continue;
    }

    const key =
      part
        .slice(0, index)
        .trim();

    if (
      key !== name
    ) {

      continue;
    }

    return decodeURIComponent(
      part
        .slice(index + 1)
        .trim()
    );
  }

  return null;
}


function setSessionCookie(
  res,
  token
) {

  res.setHeader(
    "Set-Cookie",
    [
      `dimzlink_admin=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      `Max-Age=${Math.floor(
        SESSION_MAX_AGE / 1000
      )}`
    ].join("; ")
  );
}


function clearSessionCookie(
  res
) {

  res.setHeader(
    "Set-Cookie",
    [
      "dimzlink_admin=",
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=0"
    ].join("; ")
  );
}


/*
========================================================
 AUTH
========================================================
*/

function isAuthenticated(
  req
) {

  const token =
    getCookie(
      req,
      "dimzlink_admin"
    );

  return validateSession(
    token
  );
}


/*
========================================================
 BODY
========================================================
*/

async function parseBody(
  req
) {

  if (
    req.body &&
    typeof req.body ===
      "object"
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


/*
========================================================
 GET ALL LINKS
========================================================
*/

async function getAllLinks() {

  let cursor =
    "0";

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
        result?.[0] ||
        "0"
      );

    const found =
      result?.[1] ||
      [];

    for (
      const key
      of found
    ) {

      const keyString =
        String(key);

      /*
      Counter click terpisah
      tidak dihitung sebagai link.
      */

      if (
        keyString.startsWith(
          "dimzlink:clicks:"
        )
      ) {

        continue;
      }

      keys.push(
        keyString
      );
    }

  } while (
    cursor !== "0"
  );

  const links = [];

  for (
    const key
    of keys
  ) {

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

      if (
        !link ||
        !link.alias
      ) {

        continue;
      }

      /*
      Ambil click counter
      dari Redis.
      */

      const clickRaw =
        await redisCommand(
          "GET",
          `dimzlink:clicks:${link.alias}`
        );

      const clickNumber =
        Number(
          clickRaw
        );

      link.clicks =
        Number.isFinite(
          clickNumber
        )
          ? clickNumber
          : Number(
              link.clicks || 0
            );

      links.push(
        link
      );

    } catch {
      // Ignore corrupted link.
    }
  }

  return links;
}


/*
========================================================
 STATS
========================================================
*/

function buildStats(
  links
) {

  const stats = {

    totalLinks:
      links.length,

    totalClicks:
      0,

    devices: {
      mobile: 0,
      tablet: 0,
      desktop: 0,
      unknown: 0
    },

    browsers: {},

    countries: {},

    languages: {},

    clicksByDay: {}
  };


  for (
    const link
    of links
  ) {

    stats.totalClicks +=
      Number(
        link.clicks || 0
      );

    const logs =
      Array.isArray(
        link.clickLog
      )
        ? link.clickLog
        : [];

    for (
      const click
      of logs
    ) {

      const device =
        click.device ||
        "unknown";

      if (
        Object.prototype.hasOwnProperty.call(
          stats.devices,
          device
        )
      ) {

        stats.devices[device]++;

      } else {

        stats.devices.unknown++;
      }


      const browser =
        click.browser ||
        "Unknown";

      stats.browsers[browser] =
        (
          stats.browsers[browser] ||
          0
        ) + 1;


      const country =
        click.country ||
        "Unknown";

      stats.countries[country] =
        (
          stats.countries[country] ||
          0
        ) + 1;


      const language =
        click.language ||
        "Unknown";

      stats.languages[language] =
        (
          stats.languages[language] ||
          0
        ) + 1;


      if (
        click.time
      ) {

        const date =
          new Date(
            click.time
          );

        if (
          !Number.isNaN(
            date.getTime()
          )
        ) {

          const day =
            date
              .toISOString()
              .slice(0, 10);

          stats.clicksByDay[day] =
            (
              stats.clicksByDay[day] ||
              0
            ) + 1;
        }
      }
    }
  }

  return stats;
}


/*
========================================================
 SANITIZE LINK FOR ADMIN
========================================================
*/

function publicAdminLink(
  link
) {

  return {

    alias:
      link.alias,

    destination:
      link.destination,

    expiresAt:
      link.expiresAt ||
      null,

    createdAt:
      link.createdAt ||
      null,

    clicks:
      Number(
        link.clicks || 0
      ),

    lastClickAt:
      link.lastClickAt ||
      null,

    passwordProtected:
      Boolean(
        link.passwordHash
      ),

    mobileUrl:
      link.mobileUrl ||
      null,

    desktopUrl:
      link.desktopUrl ||
      null,

    countryRules:
      link.countryRules ||
      {},

    languageRules:
      link.languageRules ||
      {},

    recentClicks:
      Array.isArray(
        link.clickLog
      )
        ? link.clickLog.slice(-50)
        : []
  };
}


/*
========================================================
 ALIAS VALIDATION
========================================================
*/

function normalizeAlias(
  alias
) {

  return String(
    alias || ""
  )
    .trim()
    .replace(
      /[^A-Za-z0-9_-]/g,
      ""
    )
    .slice(0, 32);
}


/*
========================================================
 URL VALIDATION
========================================================
*/

function validUrl(
  value
) {

  try {

    const url =
      new URL(value);

    return (
      url.protocol ===
        "http:" ||
      url.protocol ===
        "https:"
    );

  } catch {

    return false;
  }
}


/*
========================================================
 UPDATE LINK
========================================================
*/

async function updateLink(
  input
) {

  const alias =
    normalizeAlias(
      input.alias
    );

  if (!alias) {

    throw new Error(
      "Alias tidak valid."
    );
  }

  const key =
    `dimzlink:${alias}`;

  const raw =
    await redisCommand(
      "GET",
      key
    );

  if (!raw) {

    const error =
      new Error(
        "Shortlink tidak ditemukan."
      );

    error.status = 404;

    throw error;
  }

  const link =
    JSON.parse(raw);


  if (
    !validUrl(
      input.destination
    )
  ) {

    const error =
      new Error(
        "Destination URL tidak valid."
      );

    error.status = 400;

    throw error;
  }


  let expiresAt =
    null;

  if (
    input.expiresAt
  ) {

    const date =
      new Date(
        input.expiresAt
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      throw new Error(
        "Expiration tidak valid."
      );
    }

    if (
      date.getTime() <=
      Date.now()
    ) {

      throw new Error(
        "Expiration harus berada di masa depan."
      );
    }

    expiresAt =
      date.toISOString();
  }


  let mobileUrl =
    input.mobileUrl ||
    null;

  let desktopUrl =
    input.desktopUrl ||
    null;


  if (
    mobileUrl &&
    !validUrl(
      mobileUrl
    )
  ) {

    throw new Error(
      "Mobile URL tidak valid."
    );
  }


  if (
    desktopUrl &&
    !validUrl(
      desktopUrl
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

  link.mobileUrl =
    mobileUrl;

  link.desktopUrl =
    desktopUrl;


  /*
  Jangan ubah:

  - ownerKey
  - passwordHash
  - clicks
  - clickLog
  - createdAt

  supaya data shortlink dan statistik
  tidak rusak saat admin melakukan edit.
  */


  await redisCommand(
    "SET",
    key,
    JSON.stringify(link)
  );

  return link;
}


/*
========================================================
 DELETE LINK
========================================================
*/

async function deleteLink(
  alias
) {

  const normalized =
    normalizeAlias(
      alias
    );

  if (!normalized) {

    throw new Error(
      "Alias tidak valid."
    );
  }

  await redisCommand(
    "DEL",
    `dimzlink:${normalized}`
  );

  await redisCommand(
    "DEL",
    `dimzlink:clicks:${normalized}`
  );
}


/*
========================================================
 MAIN HANDLER
========================================================
*/

export default async function handler(
  req,
  res
) {

  /*
  ======================================================
  BASIC CONFIG CHECK
  ======================================================
  */

  if (
    !redisReady()
  ) {

    json(
      res,
      500,
      {
        ok: false,

        error:
          "Redis belum dikonfigurasi. Pastikan DIMZLINK_KV_REST_API_URL dan DIMZLINK_KV_REST_API_TOKEN tersedia."
      }
    );

    return;
  }


  if (
    !ADMIN_PASSWORD ||
    !ADMIN_SECRET
  ) {

    json(
      res,
      500,
      {
        ok: false,

        error:
          "DIMZLINK_ADMIN_PASSWORD atau DIMZLINK_ADMIN_SECRET belum dikonfigurasi."
      }
    );

    return;
  }


  const method =
    String(
      req.method ||
      "GET"
    ).toUpperCase();


  /*
  ======================================================
  OPTIONS
  ======================================================
  */

  if (
    method === "OPTIONS"
  ) {

    res.statusCode =
      204;

    res.end();

    return;
  }


  try {

    /*
    ====================================================
    GET
    ====================================================
    */

    if (
      method === "GET"
    ) {

      /*
      Check session.
      */

      if (
        !isAuthenticated(req)
      ) {

        json(
          res,
          401,
          {
            ok: false,
            authenticated: false,
            error:
              "Admin belum login."
          }
        );

        return;
      }


      const links =
        await getAllLinks();

      const stats =
        buildStats(
          links
        );


      json(
        res,
        200,
        {
          ok: true,

          authenticated:
            true,

          links:
            links
              .map(
                publicAdminLink
              )
              .sort(
                (a, b) =>
                  Date.parse(
                    b.createdAt ||
                    0
                  ) -
                  Date.parse(
                    a.createdAt ||
                    0
                  )
              ),

          stats
        }
      );

      return;
    }


    /*
    ====================================================
    POST
    ====================================================
    */

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
      await parseBody(
        req
      );

    const action =
      String(
        body.action ||
        ""
      );


    /*
    ====================================================
    LOGIN
    ====================================================
    */

    if (
      action === "login"
    ) {

      const password =
        String(
          body.password ||
          ""
        );


      if (
        !safeEqual(
          password,
          ADMIN_PASSWORD
        )
      ) {

        /*
        Jangan kasih informasi
        password salah secara detail.
        */

        json(
          res,
          401,
          {
            ok: false,

            error:
              "Password admin salah."
          }
        );

        return;
      }


      const session =
        makeSessionToken();


      setSessionCookie(
        res,
        session
      );


      json(
        res,
        200,
        {
          ok: true,

          authenticated:
            true
        }
      );

      return;
    }


    /*
    ====================================================
    LOGOUT
    ====================================================
    */

    if (
      action === "logout"
    ) {

      clearSessionCookie(
        res
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


    /*
    ====================================================
    EVERYTHING BELOW REQUIRES LOGIN
    ====================================================
    */

    if (
      !isAuthenticated(req)
    ) {

      json(
        res,
        401,
        {
          ok: false,

          authenticated:
            false,

          error:
            "Sesi admin sudah berakhir."
        }
      );

      return;
    }


    /*
    ====================================================
    EDIT
    ====================================================
    */

    if (
      action === "update"
    ) {

      const link =
        await updateLink(
          body
        );


      json(
        res,
        200,
        {
          ok: true,

          link:
            publicAdminLink(
              link
            )
        }
      );

      return;
    }


    /*
    ====================================================
    DELETE
    ====================================================
    */

    if (
      action === "delete"
    ) {

      await deleteLink(
        body.alias
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


    /*
    ====================================================
    UNKNOWN ACTION
    ====================================================
    */

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
      "DIMZLINK ADMIN API ERROR:",
      error
    );


    json(
      res,
      error.status ||
        500,
      {
        ok: false,

        error:
          error.message ||
          "Internal server error."
      }
    );
  }
}