/* 홍성군 대형폐기물 도우미 — 스텝 상태머신 */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const won = n => n === null || n === undefined ? "면제" : n.toLocaleString("ko-KR") + "원";

  const STEPS = ["home", "consent", "input", "result", "done"];
  // AI 서버 주소: 같은 서버(맥미니에서 직접 서비스)면 빈 값. 외부 호스팅(GitHub Pages 등)이면
  // 주소 뒤에 ?api=https://맥미니터널주소 를 한 번 붙여 열면 저장됩니다.
  let API = "";
  try {
    const q = new URLSearchParams(location.search).get("api");
    if (q !== null) { API = q.replace(/\/$/, ""); localStorage.setItem("hs_api", API); history.replaceState(null, "", location.pathname); }
    else API = localStorage.getItem("hs_api") || "";
  } catch {}
  const api = path => API + path;
  const MODE_LABEL = { sticker: "수수료 스티커 구입", ppeggi: "빼기 앱으로 신고" };

  const state = { mode: "sticker", step: "home", photoFile: null, photoB64: null, size: {}, note: "",
    ai: null, pick: null, specIdx: 0, optIdx: 0, manual: false };

  // ───────── 데이터 접근 ─────────
  const P = window.PRICELIST, G = window.PPEGGI, C = window.CONTACTS;
  const groupName = id => (P.groups.find(g => g.id === id) || {}).name || "";
  const stickerItems = () => P.items;
  let _pp;
  const ppeggiItems = () => _pp || (_pp = G.categories.flatMap(c => c.tiles.flatMap(t => t.items.map(i => {
    const ref = i.ref ? P.items.find(x => x.id === i.ref) : null;
    const specs = i.specs || (ref ? ref.specs : [["모든 규격", null]]);
    return { ...i, group: c.id, groupName: c.name, tile: t.name, path: `${c.name} › ${t.name} › ${i.name}`,
      specs, sizeRule: ref ? ref.sizeRule : null, refName: ref ? ref.name : null, note: i.note || (ref ? ref.note : "") };
  }))));
  const itemsFor = mode => mode === "ppeggi" ? ppeggiItems() : stickerItems();
  const namesFor = mode => mode === "ppeggi" ? ppeggiItems().map(i => i.path) : stickerItems().map(i => i.name);

  const norm = s => String(s || "").toLowerCase().replace(/[\s()\-·,\.]/g, "");
  function findItem(mode, text) {
    const items = itemsFor(mode); const t = norm(text);
    if (!t) return null;
    const key = mode === "ppeggi" ? i => [i.path, i.name, ...(i.aliases || [])] : i => [i.name, ...(i.aliases || [])];
    return items.find(i => key(i).some(k => norm(k) === t))
      || items.find(i => key(i).some(k => t.includes(norm(k)) || norm(k).includes(t)))
      || null;
  }

  function suggestSpec(item, size) {
    const r = item.sizeRule; if (!r) return 0;
    if (r.custom === "bookshelf") return (size.w >= 90 && size.h >= 180) ? 0 : (size.w || size.h ? 1 : 0);
    const v = size[r.dim]; if (!v) return 0;
    for (const [th, idx] of r.cuts) if (v >= th) return idx;
    return r.else;
  }

  // ───────── 네비게이션 ─────────
  function go(step) {
    state.step = step;
    $$(".step").forEach(s => s.hidden = s.dataset.step !== step);
    $("#progressBar").style.width = (STEPS.indexOf(step) / (STEPS.length - 1) * 100) + "%";
    $("#btnRestart").hidden = step === "home";
    const cta = $("#ctaBar"); const btn = $("#ctaBtn");
    const labels = { consent: "시작하기", input: "AI로 확인하기", result: "다음 할 일 보기", done: "처음으로" };
    cta.hidden = step === "home";
    document.body.classList.toggle("no-cta", step === "home");
    btn.textContent = labels[step] || "";
    updateCta();
    window.scrollTo(0, 0);
    if (step === "result") renderResult();
    if (step === "done") renderDone();
  }
  function updateCta() {
    const btn = $("#ctaBtn");
    if (state.step === "consent") btn.disabled = !$("#agree").checked;
    else if (state.step === "input") btn.disabled = !state.photoB64;
    else if (state.step === "result") btn.disabled = !state.pick;
    else btn.disabled = false;
  }

  $$("[data-go]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); reset(); go(el.dataset.go); }));
  $$(".choice").forEach(el => el.addEventListener("click", () => { state.mode = el.dataset.mode; renderConsent(); go("consent"); }));
  $("#agree").addEventListener("change", updateCta);
  $("#ctaBtn").addEventListener("click", () => {
    if (state.step === "consent") { renderInput(); go("input"); }
    else if (state.step === "input") { readInputs(); state.manual = false; go("result"); }
    else if (state.step === "result") go("done");
    else if (state.step === "done") { reset(); go("home"); }
  });
  $("#btnManual").addEventListener("click", () => { readInputs(); state.manual = true; go("result"); });

  function reset() {
    Object.assign(state, { photoFile: null, photoB64: null, size: {}, note: "", ai: null, pick: null, specIdx: 0, optIdx: 0, manual: false });
    $("#agree").checked = false; $("#photo").value = ""; $("#photoCam").value = ""; $("#photoPreview").hidden = true; $("#photoEmpty").hidden = false;
    ["#dimW", "#dimD", "#dimH", "#note", "#search"].forEach(s => $(s).value = "");
  }

  // ───────── 연락처 ─────────
  function contactRow(c) {
    const tel = c.phone ? `<a class="tel" href="tel:${c.phone.replace(/-/g, "")}">${c.phone}</a>` : `<span class="pending">확인 중</span>`;
    return `<div class="contact"><div class="cl"><b>${c.label || c.name}</b>${c.desc ? `<small>${c.desc}</small>` : ""}</div>${tel}</div>`;
  }
  function contactsHtml(withTowns) {
    const towns = C.towns.filter(t => t.phone);
    return `<h2>문의 전화</h2><div class="contacts">${[...C.county, ...C.collectors].map(contactRow).join("")}${withTowns && towns.length ? towns.map(t => contactRow({ label: t.name + " 행정복지센터", phone: t.phone })).join("") : ""}</div>`;
  }
  $("#homeContacts").innerHTML = contactsHtml(true);

  // ───────── 1. 동의 ─────────
  function renderConsent() {
    $("#consentMode").textContent = MODE_LABEL[state.mode];
    $("#consentLede").textContent = state.mode === "sticker"
      ? "조례 별표1 품목과 규격에 맞는 수수료 스티커를 읍·면 행정복지센터에서 구입해 부착한 뒤 배출합니다."
      : "빼기 앱에서 배출 장소·날짜와 품목을 신고하고 결제하면 스티커 없이 수거됩니다. 앱에서 어느 항목을 골라야 하는지 알려드립니다.";
    $("#consentContacts").innerHTML = [...C.county, ...C.collectors].map(contactRow).join("");
  }

  // ───────── 2. 입력 ─────────
  function renderInput() { $("#inputMode").textContent = MODE_LABEL[state.mode]; checkAI(); }
  function readInputs() {
    state.size = { w: +$("#dimW").value || 0, d: +$("#dimD").value || 0, h: +$("#dimH").value || 0 };
    state.note = $("#note").value.trim();
  }
  async function onPhoto(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    $("#photoEmpty").querySelector("b").textContent = "사진을 불러오는 중…";
    try {
      const b64 = await resizeToJpeg(f, 1024, 0.85);
      state.photoB64 = b64; state.photoFile = f;
      const img = $("#photoPreview"); img.src = b64; img.hidden = false; $("#photoEmpty").hidden = true;
    } catch (err) {
      state.photoB64 = null; $("#photoEmpty").querySelector("b").textContent = "아직 사진이 없어요";
      toast(/heic|heif/i.test(f.type + f.name) || err.message === "decode"
        ? "이 사진 형식(HEIC 등)은 열 수 없어요. 카메라 설정에서 '고효율 사진'을 끄거나 앨범에서 JPG 사진을 골라 주세요."
        : "사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.");
    }
    e.target.value = "";
    updateCta();
  }
  $("#photo").addEventListener("change", onPhoto);
  $("#photoCam").addEventListener("change", onPhoto);
  async function resizeToJpeg(file, max, q) {
    const draw = (src, w, h) => {
      const s = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", q);
    };
    if (window.createImageBitmap) {
      try { const bm = await createImageBitmap(file, { imageOrientation: "from-image" }); const out = draw(bm, bm.width, bm.height); bm.close(); return out; } catch {}
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { try { resolve(draw(img, img.naturalWidth, img.naturalHeight)); } catch (e) { reject(new Error("decode")); } URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  // ───────── 3. 결과 ─────────
  async function renderResult() {
    $("#resultMode").textContent = MODE_LABEL[state.mode];
    $("#manualTitle").textContent = state.manual ? "목록에서 찾기" : "결과가 다르면 직접 찾기";
    renderList("");
    const body = $("#resultBody"), status = $("#aiStatus");
    body.hidden = true; status.hidden = true; state.pick = null; updateCta();
    if (state.manual || !state.photoB64) return;
    status.hidden = false;
    try {
      const r = await fetch(api("/api/classify"), { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: state.mode, image: state.photoB64, names: namesFor(state.mode), size: state.size, note: state.note }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || r.status);
      state.ai = data;
      const item = findItem(state.mode, data.item);
      if (!item) throw new Error("no_match");
      choose(item, data);
    } catch (err) {
      status.hidden = true;
      const msg = { timeout: "AI 응답이 너무 오래 걸렸습니다.", rate_limited: "요청이 많아 잠시 후 다시 시도해 주세요.", no_match: "AI가 목록에 있는 품목을 찾지 못했습니다." }[err.message]
        || "AI 서버에 연결하지 못했습니다.";
      $("#resultTitle").textContent = "AI 판별을 할 수 없어요";
      $("#resultReason").textContent = msg + " 아래 목록에서 직접 찾아 주세요.";
      $("#resultCard").hidden = true; $("#altBlock").hidden = true; body.hidden = false;
    }
  }

  function choose(item, ai) {
    $("#aiStatus").hidden = true;
    state.pick = item;
    state.specIdx = item.specIdx != null ? item.specIdx : suggestSpec(item, state.size);
    state.optIdx = 0;
    const body = $("#resultBody"); body.hidden = false;
    const name = state.mode === "ppeggi" ? item.name : item.name;
    if (ai) {
      const pct = Math.round((ai.confidence || 0) * 100);
      $("#resultTitle").innerHTML = `이 물건은<br><em>${name}</em>(으)로 보여요`;
      $("#resultReason").textContent = (ai.reason || "") + (pct ? ` (신뢰도 ${pct}%)` : "") + (ai.mock ? " · 모의 응답" : "");
    } else {
      $("#resultTitle").innerHTML = `<em>${name}</em>`;
      $("#resultReason").textContent = state.mode === "sticker" ? `${groupName(item.group)} 품목입니다.` : `${item.groupName} 분류입니다.`;
    }
    $("#resultCard").hidden = false; renderCard();
    const alts = (ai && ai.alternatives || []).map(a => findItem(state.mode, a)).filter(a => a && a.id !== item.id);
    $("#altBlock").hidden = alts.length === 0;
    $("#altChips").innerHTML = alts.map(a => `<button class="chip" type="button" data-alt="${a.id}">${state.mode === "ppeggi" ? a.path : a.name}</button>`).join("");
    $$("#altChips .chip").forEach(b => b.addEventListener("click", () => { const it = itemsFor(state.mode).find(i => i.id === b.dataset.alt); choose(it, null); window.scrollTo({ top: 0, behavior: "smooth" }); }));
    updateCta();
  }

  function renderCard() {
    const it = state.pick; const card = $("#resultCard");
    if (state.mode === "sticker") {
      const specs = it.specs; const [spec, fee] = specs[state.specIdx];
      const free = fee === null;
      card.innerHTML = `
        <div class="label">조례 별표1 품목</div>
        <div class="item">${it.name}</div>
        <div class="group">${groupName(it.group)}</div>
        ${state.ai && state.ai.size_hint && state.pick === findItem("sticker", state.ai.item) ? `<span class="hint">${state.ai.size_hint}</span>` : ""}
        ${specs.length > 1 ? `<div class="specs"><h3>규격을 골라 주세요${it.sizeRule && (state.size.w || state.size.h) ? " · 입력한 치수로 추천됨" : ""}</h3><div class="chips">${specs.map((s, i) => `<button class="chip" type="button" data-spec="${i}" aria-pressed="${i === state.specIdx}">${s[0]} · ${won(s[1])}</button>`).join("")}</div></div>` : ""}
        <div class="fee"><div class="amt ${free ? "free" : ""}">${free ? "수수료 면제" : won(fee)}</div><div class="spec">${spec}</div></div>
        ${free ? `<p class="note">가전제품은 폐가전 무상방문수거(1599-0903)로 신청하면 수수료 없이 가져갑니다. 원형이 훼손된 제품은 제외됩니다.</p>` : ""}
        ${it.note ? `<p class="note">${it.note}</p>` : ""}`;
      $$("[data-spec]", card).forEach(b => b.addEventListener("click", () => { state.specIdx = +b.dataset.spec; renderCard(); }));
    } else {
      const specs = it.specs; const [spec, fee] = specs[state.specIdx]; const free = fee === null && it.ref;
      const fixed = it.specIdx != null;
      card.innerHTML = `
        <div class="label">빼기 앱에서 고를 항목</div>
        <div class="item">${it.name}</div>
        <div class="group">${it.groupName} › ${it.tile}${it.inferred ? " <span class='hint'>위치 추정</span>" : ""}</div>
        ${specs.length > 1 && !fixed ? `<div class="specs"><h3>규격 선택${it.sizeRule && (state.size.w || state.size.h) ? " · 입력한 치수로 추천됨" : ""}</h3><div class="chips">${specs.map((s, i) => `<button class="chip" type="button" data-spec="${i}" aria-pressed="${i === state.specIdx}">${s[0]}${s[1] !== undefined && (s[1] !== null || it.ref) ? " · " + won(s[1]) : ""}</button>`).join("")}</div></div>` : ""}
        <div class="fee"><div class="amt ${free ? "free" : ""}">${it.ref ? (free ? "수수료 면제" : won(fee)) : "앱에서 확인"}</div><div class="spec">${spec}</div></div>
        <p class="note">${G.feeNote}</p>
        ${free ? `<p class="note">가전제품은 폐가전 무상방문수거(1599-0903)로 신청하면 수수료 없이 가져갑니다.</p>` : ""}
        ${it.note ? `<p class="note">${it.note}</p>` : ""}`;
      $$("[data-spec]", card).forEach(b => b.addEventListener("click", () => { state.specIdx = +b.dataset.spec; renderCard(); }));
    }
  }

  // 목록 검색
  function renderList(q) {
    const t = norm(q); const items = itemsFor(state.mode); const list = $("#list");
    const match = i => !t || [i.name, i.path, ...(i.aliases || [])].some(k => k && norm(k).includes(t));
    const groups = state.mode === "ppeggi" ? G.categories.map(c => ({ id: c.id, name: c.name })) : P.groups;
    const feeOf = i => { if (i.specIdx != null) return won(i.specs[i.specIdx][1]); const fees = [...new Set(i.specs.map(s => s[1]))]; const nums = fees.filter(f => f !== null);
      if (state.mode === "ppeggi" && !i.ref) return ""; return fees.length === 1 ? won(fees[0]) : nums.length ? `${won(Math.min(...nums))}~` : "면제"; };
    let html = "";
    for (const g of groups) {
      const rows = items.filter(i => i.group === g.id && match(i));
      if (!rows.length) continue;
      html += `<div class="gh">${g.name}</div>` + rows.map(i => {
        const sub = state.mode === "ppeggi" ? `<span class="tile-sub">${i.tile}</span>` : "";
        return `<button type="button" data-id="${i.id}"><span>${i.name}${sub}</span><small>${feeOf(i)}</small></button>`;
      }).join("");
    }
    list.innerHTML = html || `<div class="empty">검색 결과가 없습니다. "그 외 봉투에 담기 어려운 폐기물"을 선택해 주세요.</div>`;
    $$("button[data-id]", list).forEach(b => b.addEventListener("click", () => { choose(items.find(i => i.id === b.dataset.id), null); window.scrollTo({ top: 0, behavior: "smooth" }); }));
  }
  $("#search").addEventListener("input", e => renderList(e.target.value));

  // ───────── 4. 완료 ─────────
  function summaryRows() {
    const it = state.pick; if (!it) return [];
    if (state.mode === "sticker") {
      const [spec, fee] = it.specs[state.specIdx];
      return [["방법", "수수료 스티커"], ["품목", `${it.name} (${groupName(it.group)})`], ["규격", spec], ["수수료", fee === null ? "면제 (무상수거)" : won(fee)]];
    }
    const [spec, fee] = it.specs[state.specIdx];
    return [["방법", "빼기 앱"], ["분류", `${it.groupName} › ${it.tile}`], ["항목", it.name], ["규격", spec], ["수수료(조례 기준)", it.ref ? (fee === null ? "면제" : won(fee)) : "앱에서 확인"]];
  }
  function renderDone() {
    $("#doneMode").textContent = MODE_LABEL[state.mode];
    $("#summaryCard").innerHTML = summaryRows().map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join("");
    const it = state.pick; const free = it && (state.mode === "sticker" || it.ref) && it.specs[state.specIdx][1] === null;
    let todo;
    if (free && state.mode === "sticker") todo = [
      ["폐가전 무상방문수거 신청", `<a href="tel:15990903">1599-0903</a> 또는 인터넷(15990903.or.kr)으로 수거를 예약하세요. 수수료가 없습니다.`],
      ["수거일에 현관 앞에 내놓기", "원형이 훼손된 제품(문짝·압축기 분리 등)은 무상수거가 어려우니 스티커 구입이 필요할 수 있습니다."],
      ["궁금하면 환경과에 문의", `<a href="tel:0416301350">041-630-1350</a>`]];
    else if (state.mode === "sticker") todo = [
      ["읍·면 행정복지센터에서 스티커 구입", `위 규격의 스티커(${it ? won(it.specs[state.specIdx][1]) : ""})를 구입하면서 배출 장소와 날짜를 신고하세요.`],
      ["스티커를 잘 보이는 곳에 부착", "스티커가 없거나 신고 내용과 다르면 수거되지 않을 수 있습니다."],
      ["신고한 날짜에 지정 장소에 배출", `수거 문의: 홍주환경 <a href="tel:0416343999">041-634-3999</a> · 우리환경 <a href="tel:0416347554">041-634-7554</a>`]];
    else todo = [
      ["빼기 앱 열기", `<a href="${C.ppeggi.android}" target="_blank" rel="noopener">Android</a> · <a href="${C.ppeggi.ios}" target="_blank" rel="noopener">iPhone</a> · <a href="${C.ppeggi.web}" target="_blank" rel="noopener">웹</a>`],
      ["홍성군 선택 후 품목 고르기", `<b style="font-weight:500">${it ? `${it.groupName} › ${it.tile} › ${it.name}` : ""}</b> 순서로 고르고 규격 "${it ? it.specs[state.specIdx][0] : ""}"을 선택한 뒤 배출 장소·날짜를 입력하세요.`],
      ["결제 후 신고 번호 확인", "앱에서 안내한 날짜에 지정 장소에 내놓으면 됩니다. 신고 내용과 실제가 다르면 수거되지 않을 수 있습니다."]];
    $("#todoList").innerHTML = todo.map(([b, s]) => `<li><div><b>${b}</b><span>${s}</span></div></li>`).join("");
    $("#doneContacts").innerHTML = contactsHtml(true);
  }
  $("#btnCopy").addEventListener("click", async () => {
    const text = "홍성군 대형폐기물 도우미\n" + summaryRows().map(([k, v]) => `${k}: ${v}`).join("\n") + "\n문의 041-630-1350";
    try { await navigator.clipboard.writeText(text); toast("복사했습니다"); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("복사했습니다"); } catch { toast("복사할 수 없습니다"); } ta.remove(); }
  });

  // ───────── 유틸 ─────────
  let toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  // AI 서버 상태 표시 + 주소 설정
  let aiOk = false;
  async function checkAI() {
    const dot = $("#aiDot"), st = $("#aiState");
    dot.className = "dot"; st.textContent = "AI 서버 확인 중…"; aiOk = false;
    try {
      const r = await fetch(api("/api/health"), { signal: AbortSignal.timeout(6000) });
      const h = await r.json();
      if (!h.ok) throw new Error(h.error || "down");
      if (h.modelInstalled === false) { dot.className = "dot bad"; st.textContent = `모델 ${h.model} 미설치 — 맥미니에서 ollama pull 필요`; return; }
      aiOk = true; dot.className = "dot ok"; st.textContent = API ? `AI 서버 연결됨 (${h.model || "모델"})` : `AI 서버 연결됨 (${h.model || "모델"})`;
    } catch {
      dot.className = "dot bad";
      st.textContent = API ? "AI 서버에 연결되지 않음 — 맥미니 서버·터널 주소를 확인하세요" : "AI 서버 없음 — 맥미니 터널 주소를 설정하세요";
    }
  }
  $("#aiToggle").addEventListener("click", () => { const f = $("#aiForm"); f.hidden = !f.hidden; $("#aiUrl").value = API; if (!f.hidden) $("#aiUrl").focus(); });
  $("#aiSave").addEventListener("click", () => {
    let v = $("#aiUrl").value.trim().replace(/\/+$/, "");
    if (v && !/^https?:\/\//.test(v)) v = "https://" + v;
    API = v; try { localStorage.setItem("hs_api", API); } catch {}
    $("#aiForm").hidden = true; checkAI(); toast(API ? "주소를 저장했습니다" : "같은 서버를 사용합니다");
  });
  $("#aiClear").addEventListener("click", () => { API = ""; try { localStorage.removeItem("hs_api"); } catch {} $("#aiUrl").value = ""; $("#aiForm").hidden = true; checkAI(); });
  checkAI();

  go("home");
})();
