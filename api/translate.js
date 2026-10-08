// DIMZLINK dynamic translation proxy.
// Set GOOGLE_TRANSLATE_API_KEY in Vercel Environment Variables.
// The key never reaches the browser.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) {
    return res.status(503).json({ error: "Translation service is not configured" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const texts = Array.isArray(body.texts) ? body.texts : [];
    const target = String(body.target || "").trim().replace(/_/g, "-");
    const source = body.source ? String(body.source).trim().replace(/_/g, "-") : "";

    if (!target || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(target)) {
      return res.status(400).json({ error: "Invalid target language" });
    }
    if (!texts.length || texts.length > 100) {
      return res.status(400).json({ error: "texts must contain 1-100 items" });
    }

    const clean = texts.map(v => String(v ?? "")).filter(v => v.length <= 5000);
    if (!clean.length) return res.status(400).json({ error: "No translatable text" });

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(source ? { source } : {}), q: clean, target, format: "text" })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status >= 400 && response.status < 500 ? 400 : 502).json({
        error: data?.error?.message || "Translation provider error"
      });
    }

    const translations = data?.data?.translations || [];
    return res.status(200).json({
      translations: translations.map(x => x.translatedText || ""),
      detectedSourceLanguage: translations[0]?.detectedSourceLanguage || source || "auto",
      target
    });
  } catch (error) {
    return res.status(500).json({ error: "Translation request failed" });
  }
}
