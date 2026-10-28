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
// 모델을 메모리에 계속 올려 둠(기본 5분 후 내려가 다음 요청이 10~30초 느려지는 것 방지)
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "24h";

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

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" };
function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS });
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

const PICK_SCHEMA = {
  type: "object",
  properties: {
    item: { type: "string" },
    alternatives: { type: "array", items: { type: "string" } },
    confidence: { type: "number" },
    reason: { type: "string" }
  },
  required: ["item", "alternatives", "confidence", "reason"]
};
const DESCRIBE_SCHEMA = {
  type: "object",
  properties: {
    object: { type: "string" },
    kind: { type: "string" },
    description: { type: "string" },
    size_hint: { type: "string" }
  },
  required: ["object", "kind", "description", "size_hint"]
};

async function ollamaChat(messages, format, signal) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST", signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, format, keep_alive: KEEP_ALIVE,
      options: { temperature: 0.1, num_predict: 220 }, messages })
  });
  if (!r.ok) throw new Error(`ollama_${r.status}`);
  const data = await r.json();
  try { return JSON.parse(data.message?.content || "{}"); } catch { throw new Error("bad_json"); }
}

const norm = s => String(s || "").toLowerCase().replace(/[\s()\-·,\.›>/]/g, "");
// "가구 › 의자 › 의자" → "의자" (빼기 앱 경로의 마지막 조각)
const leaf = name => String(name).split("›").pop().trim();

// 1단계: 목록 없이 사진 중앙의 주된 물건을 자유롭게 인식
function describePrompt({ size, note }) {
  const sizeTxt = size && (size.w || size.h || size.d)
    ? `사용자가 입력한 치수(cm): 가로 ${size.w || "?"} × 세로(깊이) ${size.d || "?"} × 높이 ${size.h || "?"}.` : "";
  return [
    "이 사진은 버리려는 물건을 찍은 것입니다. 사진의 중앙에 있고 가장 크게 보이는 주된 물건 하나만 보세요.",
    "배경이나 주변에 있는 다른 가구·물건은 무시하세요. 물건이 여러 개면 화면 가운데에 가장 가깝고 가장 큰 것 하나만 고르세요.",
    "그 물건이 무엇인지 가장 일반적인 한국어 이름 한 단어로 답하세요. 예: 의자, 소파, 식탁, 책상, 서랍장, 옷장, 침대, 매트리스, 냉장고, 세탁기, 텔레비전, 자전거.",
    sizeTxt, note ? `사용자 메모: ${note}` : "",
    'JSON으로만 답하세요: {"object": 물건 이름 한 단어, "kind": "가구"|"가전"|"생활용품"|"운동·취미"|"기타", "description": 생김새·용도를 15자 내외 짧게(한국어), "size_hint": 사진으로 추정한 크기·인용·단수 한 줄}'
  ].filter(Boolean).join("\n");
}

// 2단계: 인식 결과를 목록과 대조해 항목 선택 (텍스트만, 빠름)
function pickPrompt({ mode, names, object, description }) {
  const fallback = mode === "ppeggi" ? "상기이외품목중 쓰레기봉투에담기어려운폐기물" : "그 외 봉투에 담기 어려운 폐기물";
  const target = mode === "ppeggi" ? "빼기 앱 폐기물 분류 항목" : "홍성군 조례 대형폐기물 품목";
  return [
    `사진 속 물건은 "${object}"로 인식되었습니다. 설명: ${description}`,
    `아래 ${target} 목록에서 이 물건에 가장 알맞은 항목을 고르세요. 반드시 목록의 이름을 그대로(한 글자도 바꾸지 말고) 사용하세요.`,
    `같은 뜻의 다른 이름(예: 소파=쇼파, 옷장=장농, 탁자=응접탁자, 책꽂이=책장)도 고려하세요. 목록에 알맞은 것이 전혀 없으면 "${fallback}"을 고르세요.`,
    `목록:\n${names.join("\n")}`,
    'JSON으로만 답하세요: {"item": 목록의 이름, "alternatives": 다른 후보 2개(목록 이름), "confidence": 0~1, "reason": 판단 근거 한 문장(한국어)}'
  ].join("\n");
}

// 인식된 이름이 목록 항목과 정확히 같으면 모델 없이 바로 확정
function directMatch(names, object) {
  const o = norm(object);
  if (!o) return null;
  const exact = names.filter(n => norm(leaf(n)) === o || norm(n) === o);
  if (exact.length === 1) return exact[0];
  return null;
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
    // 1단계: 사진 → 물건 이름
    const seen = await ollamaChat([{ role: "user", content: describePrompt({ size, note }), images: [b64] }], DESCRIBE_SCHEMA, ctrl.signal);
    const object = String(seen.object || "").trim();
    const description = String(seen.description || "").trim();
    if (!object) throw new Error("bad_json");

    // 2단계: 이름 → 목록 항목
    const direct = directMatch(names, object);
    let picked;
    if (direct) {
      const others = names.filter(n => n !== direct && (norm(n).includes(norm(object)) || norm(object).includes(norm(leaf(n))))).slice(0, 2);
      picked = { item: direct, alternatives: others, confidence: 0.9, reason: `사진 중앙의 물건을 "${object}"로 인식했습니다. ${description}` };
    } else {
      picked = await ollamaChat([{ role: "user", content: pickPrompt({ mode, names, object, description }) }], PICK_SCHEMA, ctrl.signal);
      if (!picked.item) throw new Error("bad_json");
      if (!names.includes(picked.item)) {
        // 모델이 목록 이름을 살짝 바꿔 쓴 경우 보정
        const fixed = names.find(n => norm(n) === norm(picked.item) || norm(leaf(n)) === norm(picked.item)) || names.find(n => norm(n).includes(norm(picked.item)));
        if (fixed) picked.item = fixed;
      }
      picked.reason = `사진 중앙의 물건을 "${object}"로 인식했습니다. ${picked.reason || description}`;
    }
    return { ...picked, alternatives: Array.isArray(picked.alternatives) ? picked.alternatives.filter(n => n !== picked.item) : [],
      size_hint: seen.size_hint || "", seen: object, model: OLLAMA_MODEL };
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
  if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) { res.writeHead(204, CORS); return res.end(); }
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
  if (!MOCK_AI) warmup();
});

async function warmup() {
  for (let i = 0; i < 10; i++) {
    try {
      const t0 = Date.now();
      await fetch(`${OLLAMA_URL}/api/generate`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, keep_alive: KEEP_ALIVE, prompt: "" }) }).then(r => { if (!r.ok) throw new Error(r.status); });
      console.log(`모델 적재 완료 (${Date.now() - t0}ms), keep_alive=${KEEP_ALIVE}`);
      return;
    } catch (e) { await new Promise(r => setTimeout(r, 5000)); }
  }
  console.log("모델 사전 적재 실패 — 첫 요청 때 적재됩니다");
}
