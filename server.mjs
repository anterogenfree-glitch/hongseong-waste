// 홍성군 대형폐기물 배출 도우미 — 정적 파일 + Ollama 중계 서버 (외부 의존성 없음)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");

// .env 읽기 (있으면)
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
} catch {}

const PORT = Number(process.env.PORT || 8787);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5vl:7b";
const MOCK_AI = process.env.MOCK_AI === "1";
const MAX_BODY = 6 * 1024 * 1024; // 6MB (리사이즈된 JPEG base64 기준 충분)
const TIMEOUT_MS = 120_000;

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json" };

// 분당 요청 제한 (IP별)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60_000);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 20;
}

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > MAX_BODY) { reject(new Error("too_large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string" },
    alternatives: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    size_hint: { type: "string" },
    reason: { type: "string" }
  },
  required: ["item", "alternatives", "confidence", "reason"]
};

function buildPrompt({ mode, names, size, note }) {
  const sizeTxt = size && (size.w || size.h || size.d)
    ? `사용자가 입력한 치수(cm): 가로 ${size.w || "?"} × 세로(깊이) ${size.d || "?"} × 높이 ${size.h || "?"}.` : "치수 정보 없음.";
  const target = mode === "ppeggi" ? "빼기 앱 폐기물 분류 항목" : "홍성군 조례 대형폐기물 품목";
  return [
    `당신은 대형폐기물 분류 도우미입니다. 사진 속 주된 물건 하나를 보고, 아래 ${target} 목록 중에서 가장 알맞은 항목 이름을 고르세요.`,
    `반드시 목록에 있는 이름을 그대로(한 글자도 바꾸지 말고) 사용하세요. 목록에 없으면 "${mode === "ppeggi" ? "상기이외품목중 쓰레기봉투에담기어려운폐기물" : "그 외 봉투에 담기 어려운 폐기물"}"을 고르세요.`,
    `목록: ${names.join(" | ")}`,
    sizeTxt,
    note ? `사용자 메모: ${note}` : "",
    `JSON으로만 답하세요: {"item": 목록의 이름, "alternatives": 다른 후보 2개(목록 이름), "confidence": 0~1, "size_hint": 사진으로 추정한 크기·인용·단수 등 한 줄, "reason": 판단 근거 한 문장(한국어)}`
  ].filter(Boolean).join("\n");
}

async function classify(body) {
  const { mode = "sticker", image, names = [], size, note } = body;
  if (!Array.isArray(names) || names.length === 0) throw new Error("names_required");
  if (MOCK_AI) {
    await new Promise(r => setTimeout(r, 600));
    const pick = names.find(n => /쇼파|소파/.test(n)) || names[0];
    return { item: pick, alternatives: names.filter(n => n !== pick).slice(0, 2), confidence: 0.86,
      size_hint: "3~4인이 앉을 수 있는 패브릭 소파로 보임", reason: "(모의 응답) 등받이와 팔걸이가 있는 긴 좌석 가구입니다.", mock: true, model: "mock" };
  }
  if (typeof image !== "string" || image.length < 100) throw new Error("image_required");
  const b64 = image.replace(/^data:image\/\w+;base64,/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST", signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL, stream: false, format: SCHEMA,
        options: { temperature: 0.1 },
        messages: [{ role: "user", content: buildPrompt({ mode, names, size, note }), images: [b64] }]
      })
    });
    if (!r.ok) throw new Error(`ollama_${r.status}`);
    const data = await r.json();
    let parsed;
    try { parsed = JSON.parse(data.message?.content || "{}"); } catch { throw new Error("bad_json"); }
    if (!parsed.item) throw new Error("bad_json");
    return { ...parsed, alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [], model: OLLAMA_MODEL };
  } finally { clearTimeout(timer); }
}

async function health() {
  if (MOCK_AI) return { ok: true, mock: true, model: "mock" };
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const models = (d.models || []).map(m => m.name);
    return { ok: true, model: OLLAMA_MODEL, modelInstalled: models.some(n => n === OLLAMA_MODEL || n.startsWith(OLLAMA_MODEL.split(":")[0])), models };
  } catch (e) { return { ok: false, model: OLLAMA_MODEL, error: String(e.message || e) }; }
}

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }); return res.end("Not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const ip = req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "?";
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/health") return json(res, 200, await health());
  if (url.pathname === "/api/classify") {
    if (req.method !== "POST") return json(res, 405, { error: "method" });
    if (rateLimited(ip)) return json(res, 429, { error: "rate_limited" });
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const t0 = Date.now();
      const result = await classify(body);
      return json(res, 200, { ...result, ms: Date.now() - t0 });
    } catch (e) {
      const msg = String(e.message || e);
      const code = msg === "too_large" ? 413 : msg.startsWith("ollama_") || e.name === "AbortError" ? 502 : 400;
      console.error(new Date().toISOString(), "classify error:", msg);
      return json(res, code, { error: e.name === "AbortError" ? "timeout" : msg });
    }
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, "0.0.0.0", () => {
  console.log(`홍성군 대형폐기물 도우미  http://localhost:${PORT}`);
  console.log(MOCK_AI ? "AI: 모의 응답 모드(MOCK_AI=1)" : `AI: Ollama ${OLLAMA_URL} / ${OLLAMA_MODEL}`);
});
