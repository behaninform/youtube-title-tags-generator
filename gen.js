const SMALL = new Set(["a","an","the","and","or","of","in","on","at","to","for","vs","with","by","is"]);

function scriptOf(s) {
  if (/[\u0600-\u06FF]/.test(s)) return "ur";
  if (/[\u0900-\u097F]/.test(s)) return "hi";
  return "en";
}
function titleCase(s) {
  return s.split(/\s+/).map((w, i) =>
    (i > 0 && SMALL.has(w.toLowerCase())) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");
}
const nice = (s, lang) => (lang === "en" ? titleCase(s) : s);
const stripQ = s => s.replace(/[?؟]+\s*$/, "");
function fit(options, max = 70) {
  for (const o of options) if (o && o.length <= max) return o;
  const last = options[options.length - 1] || "";
  return last.length <= max ? last : last.slice(0, max).replace(/\s+\S*$/, "");
}
function uniq(list) {
  const seen = new Set(), out = [];
  for (const s of list) {
    const t = String(s || "").replace(/\s+/g, " ").trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out;
}
const compact = s => s.replace(/[^\p{L}\p{N}]/gu, "");

const SUFFIX = {
  en: { g1: y => ` – Full Guide (${y})`, g2: "? Everything You Need to Know", g3: " (Easy Tutorial)" },
  hi: { g1: y => ` – पूरी जानकारी (${y})`, g2: "? जानिए आसान तरीका", g3: " (आसान तरीका)" },
  ur: { g1: y => ` – مکمل گائیڈ (${y})`, g2: "؟ جانیں آسان طریقہ", g3: " (آسان طریقہ)" }
};

function buildTitles(kw, cands, lang, year) {
  const K = nice(kw, lang);
  const S = cands.slice(0, 3).map(s => nice(s, lang));
  const x = SUFFIX[lang];
  const t1 = S[0] ? fit([S[0] + x.g1(year), S[0]]) : fit([K + x.g1(year), K]);
  const t2 = S[1] ? fit([stripQ(S[1]) + x.g2, S[1]]) : fit([stripQ(K) + x.g2, K]);
  let t3;
  if (!S[2]) t3 = fit([K + x.g3, K]);
  else if (S[2].toLowerCase().startsWith(K.toLowerCase())) t3 = fit([S[2] + x.g3, S[2]]);
  else t3 = fit([K + ": " + S[2] + x.g3, K + ": " + S[2], S[2]]);
  return [t1, t2, t3];
}

const STOP = new Set(["how","to","make","in","at","the","a","an","of","for","and","best","with","what","is","why","new","me","my","kaise","kese","kaisay","kya","ka","ki","ke","ko","se","par","hai","free"]);
function buildHashtags(kw, cands, year) {
  const words = kw.split(/\s+/).map(compact).filter(w => w.length >= 4 && !STOP.has(w.toLowerCase()));
  const low = kw.toLowerCase();
  const rest = cands.slice(0, 4)
    .filter(c => c.toLowerCase().startsWith(low))
    .map(c => compact(c.slice(kw.length)))
    .filter(r => r.length >= 4 && r.length <= 20);
  const list = [...words.slice(0, 2), compact(kw), compact(kw) + year, ...rest]
    .filter(h => h.length >= 3 && h.length <= 30);
  return uniq(list).slice(0, 5).map(h => "#" + h);
}

function buildTags(kw, cands, lang, year, limit = 480) {
  const low = s => (lang === "en" ? s.toLowerCase() : s);
  const items = uniq([kw, kw + " " + year, ...cands].map(s => low(s).replace(/[<>"]/g, "")));
  const picked = [];
  let len = 0;
  for (const it of items) {
    const add = (picked.length ? 2 : 0) + it.length;
    if (len + add > limit) continue;
    picked.push(it);
    len += add;
  }
  return picked.join(", ");
}

function buildDescription(kw, cands, lang, hashtags) {
  const K = nice(kw, lang);
  const bul = cands.slice(0, 5).map(s => "• " + nice(s, lang)).join("\n");
  const tags = hashtags.join(" ");
  if (lang === "ur") {
    return `${K} — اس ویڈیو میں ہم ان باتوں پر بات کریں گے:\n${bul}\n\nویڈیو آخر تک دیکھیں اور پسند آئے تو لائک، شیئر اور سبسکرائب ضرور کریں۔\n\n${tags}`;
  }
  if (lang === "hi") {
    return `${K} — इस वीडियो में हम इन बातों पर बात करेंगे:\n${bul}\n\nवीडियो पूरी देखें और पसंद आए तो लाइक, शेयर और सब्सक्राइब ज़रूर करें।\n\n${tags}`;
  }
  return `${K} — in this video we cover:\n${bul}\n\nWatch till the end for the easy step-by-step method. If this video helped you, please like, share and subscribe for more.\n\n${tags}`;
}

function generate(kw, base, more, langOverride, year) {
  const lang = (langOverride && langOverride !== "auto") ? langOverride : scriptOf(kw);
  const low = kw.toLowerCase();
  const ranked = uniq([...base, ...more]).filter(s => s.toLowerCase() !== low);
  const titles = buildTitles(kw, ranked, lang, year);
  const hashtags = buildHashtags(kw, ranked, year);
  const tags = buildTags(kw, ranked, lang, year);
  const description = buildDescription(kw, ranked, lang, hashtags);
  return { lang, searches: ranked.slice(0, 24), titles, description, tags, tagsLength: tags.length, hashtags };
}

module.exports = { generate, scriptOf };
