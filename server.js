const express = require("express");
const path = require("path");
const { generate, scriptOf } = require("./gen");

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 10000;
app.use(express.json({ limit: "10kb" }));
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

const HL = { en: "en", ur: "ur", hi: "hi" };
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

async function suggestOnce(q, hl, client) {
  const url = "https://suggestqueries.google.com/complete/search?client=" + client +
    "&ds=yt&hl=" + hl + "&q=" + encodeURIComponent(q);
  const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = JSON.parse(await r.text());
  return Array.isArray(data[1]) ? data[1].filter(s => typeof s === "string") : [];
}
async function suggest(q, hl) {
  for (const client of ["firefox", "chrome"]) {
    try { return await suggestOnce(q, hl, client); } catch (e) { /* try next */ }
  }
  return [];
}
async function pool(tasks, n) {
  const out = new Array(tasks.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); }
  }));
  return out;
}

const cache = new Map();
const TTL = 6 * 3600 * 1000;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

app.post("/api/seo", async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  let kw = String((req.body && req.body.keyword) || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (kw.length < 2 || kw.length > 80) return res.status(400).json({ error: "Please enter a keyword (2 to 80 characters)." });
  const langOverride = ["auto", "en", "ur", "hi"].includes(req.body.lang) ? req.body.lang : "auto";
  const lang = langOverride === "auto" ? scriptOf(kw) : langOverride;
  const hl = HL[lang];
  const key = hl + ":" + kw.toLowerCase();
  let cached = cache.get(key);
  if (!cached || Date.now() - cached.t > TTL) {
    const base = await suggest(kw, hl);
    let more = [];
    if (scriptOf(kw) === "en") {
      const parts = await pool(LETTERS.map(l => () => suggest(kw + " " + l, hl)), 6);
      more = parts.flat();
    }
    if (!base.length && !more.length) {
      return res.status(502).json({ error: "Could not load search suggestions right now. Please try again in a minute." });
    }
    cached = { t: Date.now(), base, more };
    if (cache.size > 500) cache.clear();
    cache.set(key, cached);
  }
  res.json(generate(kw, cached.base, cached.more, langOverride, new Date().getFullYear()));
});

app.get("/health", (_, res) => res.send("ok"));
app.listen(PORT, () => console.log("Server running on port " + PORT));
